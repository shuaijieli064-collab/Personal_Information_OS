package com.signal.brief;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * The outbound leg of notifications: pushes selected notification types to an
 * operator-configured webhook so alerts reach a phone without the app open.
 * One env-var pair configures it — {@code NOTIFY_WEBHOOK_URL} (blank disables the
 * whole channel) and {@code NOTIFY_WEBHOOK_TYPE} (payload dialect).
 *
 * <p><b>Degradation is the contract</b>: a webhook is a convenience, never a
 * dependency. Delivery runs on a virtual thread, retries once, and every failure
 * is a warn log — it can never slow the request/job that raised the notification,
 * and the in-app inbox stays the source of truth.
 *
 * <p>Dialects cover the three group-robot protocols anyone can get for free
 * (Feishu, WeCom, DingTalk) plus a plain JSON object for anything else (IFTTT,
 * ntfy, a private script). DingTalk signs requests per their robot spec
 * (HMAC-SHA256 over {@code timestamp + "\n" + secret}) when a secret is set.
 */
@Service
public class WebhookNotifier {

    private static final Logger log = LoggerFactory.getLogger(WebhookNotifier.class);

    /** IM bots post text; WeCom rejects >2048 bytes, so a single cap keeps all dialects legal. */
    static final int MAX_TEXT_CHARS = 1800;

    private final HttpClient client;
    private final String url;
    private final String type;
    private final String secret;
    private final Set<String> acceptedTypes;
    private final boolean enabled;

    public WebhookNotifier(
            @Value("${app.notify.webhook.url:}") String url,
            @Value("${app.notify.webhook.type:feishu}") String type,
            @Value("${app.notify.webhook.secret:}") String secret,
            @Value("${app.notify.webhook.types:DAILY_BRIEF,JOB_FAILED,IMPORTANT_SIGNAL}") String acceptedTypes,
            @Value("${app.notify.webhook.timeout-ms:10000}") long timeoutMs) {
        this.url = url == null ? "" : url.trim();
        this.type = (type == null || type.isBlank()) ? "feishu" : type.trim().toLowerCase();
        this.secret = secret == null ? "" : secret.trim();
        this.acceptedTypes = (acceptedTypes == null ? "" : acceptedTypes).isBlank()
                ? Set.of()
                : java.util.Arrays.stream(acceptedTypes.split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        // URL must also be a syntactic URI: a typo should disable quietly, not NPE async later.
        this.enabled = !this.url.isBlank() && isValidUri(this.url);
        if (!this.enabled && !this.url.isBlank()) {
            log.warn("NOTIFY_WEBHOOK_URL is set but not a valid URI — webhook channel disabled");
        }
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(timeoutMs, 1000)))
                .build();
    }

    /** Fire-and-forget: never blocks the caller, never throws. Virtual thread does the work. */
    public void push(String notificationType, String title, String body) {
        if (!shouldDeliver(notificationType)) return;
        Thread.ofVirtual().name("webhook-" + notificationType).start(() -> {
            try {
                boolean sent = deliver(notificationType, title, body);
                if (!sent) { // one retry: bots rate-limit and hosts blip; a second shot is cheap
                    Thread.sleep(2_000);
                    deliver(notificationType, title, body);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                log.warn("Webhook push failed after retry: {}", e.toString());
            }
        });
    }

    /** True if this type is both enabled and on the watched list. */
    boolean shouldDeliver(String notificationType) {
        return enabled && acceptedTypes.contains(notificationType);
    }

    /**
     * Synchronous delivery — one HTTP POST, {@code true} on any 2xx. Package-visible so
     * tests assert payloads directly against a real local server.
     */
    boolean deliver(String notificationType, String title, String body) {
        try {
            String text = truncate(title, body);
            String payload = switch (type) {
                case "feishu" -> "{\"msg_type\":\"text\",\"content\":{\"text\":"
                        + jsonString(text) + "}}";
                case "wecom" -> "{\"msgtype\":\"text\",\"text\":{\"content\":"
                        + jsonString(text) + "}}";
                case "dingtalk" -> "{\"msgtype\":\"text\",\"text\":{\"content\":"
                        + jsonString(text) + "}}";
                case "json" -> "{\"type\":" + jsonString(notificationType)
                        + ",\"title\":" + jsonString(title)
                        + ",\"body\":" + jsonString(body == null ? "" : body) + "}";
                default -> {
                    log.warn("Unknown NOTIFY_WEBHOOK_TYPE '{}' — no payload sent", type);
                    yield null;
                }
            };
            if (payload == null) return false;
            HttpRequest request = HttpRequest.newBuilder(URI.create(deliverUrl()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Webhook delivered {} ({} bytes body)", notificationType, text.length());
                return true;
            }
            log.warn("Webhook {} rejected notification {} with HTTP {}", type, notificationType,
                    response.statusCode());
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            log.warn("Webhook {} could not deliver {}: {}", type, notificationType, e.toString());
            return false;
        }
    }

    /** DingTalk gets timestamp + sign appended per robot spec; everyone else posts bare. */
    String deliverUrl() {
        if (!"dingtalk".equals(type) || secret.isBlank()) return url;
        try {
            long ts = System.currentTimeMillis();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] sign = mac.doFinal((ts + "\n" + secret).getBytes(StandardCharsets.UTF_8));
            String encoded = URLEncoder.encode(
                    Base64.getEncoder().encodeToString(sign), StandardCharsets.UTF_8);
            return url + (url.contains("?") ? "&" : "?") + "timestamp=" + ts + "&sign=" + encoded;
        } catch (Exception e) {
            log.warn("DingTalk signing failed — posting unsigned: {}", e.toString());
            return url;
        }
    }

    /** One line: title, then the body — everything IM a person actually reads. */
    String truncate(String title, String body) {
        StringBuilder sb = new StringBuilder(title == null ? "" : title);
        if (body != null && !body.isBlank()) sb.append('\n').append(body);
        String s = sb.toString();
        return s.length() <= MAX_TEXT_CHARS ? s : s.substring(0, MAX_TEXT_CHARS - 1) + "…";
    }

    /** JSON string literal with the control characters escaping correctly. */
    static String jsonString(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }

    private static boolean isValidUri(String url) {
        try {
            URI.create(url).toURL();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
