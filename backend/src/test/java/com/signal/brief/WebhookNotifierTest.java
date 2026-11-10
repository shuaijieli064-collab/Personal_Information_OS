package com.signal.brief;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.ConcurrentLinkedQueue;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The outbound webhook channel: payload dialects, the type filter, and delivery
 * behaviour against a real local HTTP server — including failures that must never
 * propagate to the caller.
 */
class WebhookNotifierTest {

    private static HttpServer server;
    private static String base;
    /** Received request bodies in arrival order; async pushes are awaited by polling. */
    private static final ConcurrentLinkedQueue<String> bodies = new ConcurrentLinkedQueue<>();
    private static volatile int status = 200;

    @BeforeAll
    static void up() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/hook", exchange -> {
            bodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort() + "/hook";
    }

    @AfterAll
    static void down() {
        server.stop(0);
    }

    private WebhookNotifier notifier(String url, String type, String secret, String types) {
        return new WebhookNotifier(url, type, secret, types, 5000);
    }

    private WebhookNotifier feishu() {
        return new WebhookNotifier(base, "feishu", "", "DAILY_BRIEF,JOB_FAILED,IMPORTANT_SIGNAL", 5000);
    }

    /** Waits for the next async push to land; proves the virtual thread did its work. */
    private String awaitNextBody() throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            String body = bodies.poll();
            if (body != null) return body;
            Thread.sleep(25);
        }
        fail("the webhook never received a post");
        return null; // unreachable
    }

    // ── payload dialects ────────────────────────────────────────────────────────

    @Test
    void feishuPayloadCarriesTheTextInMsgTypeText() {
        bodies.clear();
        status = 200;
        assertTrue(feishu().deliver("DAILY_BRIEF", "Daily brief: 3 signals", "5 new items."));

        assertEquals("{\"msg_type\":\"text\",\"content\":{\"text\":\"Daily brief: 3 signals\\n5 new items.\"}}",
                bodies.poll());
    }

    @Test
    void wecomPayloadUsesMsgtypeText() {
        bodies.clear();
        status = 200;
        assertTrue(notifier(base, "wecom", "", "DAILY_BRIEF").deliver("DAILY_BRIEF", "t", "b"));

        assertEquals("{\"msgtype\":\"text\",\"text\":{\"content\":\"t\\nb\"}}", bodies.poll());
    }

    @Test
    void dingtalkPayloadUsesMsgtypeText() {
        bodies.clear();
        status = 200;
        assertTrue(notifier(base, "dingtalk", "", "JOB_FAILED").deliver("JOB_FAILED", "t", "b"));

        assertEquals("{\"msgtype\":\"text\",\"text\":{\"content\":\"t\\nb\"}}", bodies.poll());
    }

    @Test
    void jsonPayloadKeepsTypeTitleBodyAsSeparateFields() {
        bodies.clear();
        status = 200;
        assertTrue(notifier(base, "json", "", "IMPORTANT_SIGNAL")
                .deliver("IMPORTANT_SIGNAL", "title", "why it matters"));

        assertEquals("{\"type\":\"IMPORTANT_SIGNAL\",\"title\":\"title\",\"body\":\"why it matters\"}",
                bodies.poll());
    }

    @Test
    void escapingSurvivesQuotesAndNewlines() {
        String out = WebhookNotifier.jsonString("say \"hi\"\nline2\t\\path");
        assertEquals("\"say \\\"hi\\\"\\nline2\\t\\\\path\"", out);
    }

    // ── failure is a log, never an exception ─────────────────────────────────────

    @Test
    void aServerErrorIsReportedNotThrown() {
        status = 500;
        assertFalse(feishu().deliver("DAILY_BRIEF", "t", "b"));
        status = 200;
    }

    @Test
    void anUnreachableTargetIsReportedNotThrown() {
        WebhookNotifier n = notifier("http://127.0.0.1:1/hook", "feishu", "", "DAILY_BRIEF");
        assertFalse(n.deliver("DAILY_BRIEF", "t", "b"));
    }

    @Test
    void every2xxStatusCountsAsDelivered() {
        status = 204;
        try {
            assertTrue(feishu().deliver("DAILY_BRIEF", "t", "b"));
        } finally {
            status = 200;
        }
    }

    // ── filtering & disabling ────────────────────────────────────────────────────

    @Test
    void typesOutsideTheWatchListAreNotDelivered() {
        WebhookNotifier n = notifier(base, "feishu", "", "DAILY_BRIEF");
        assertFalse(n.shouldDeliver("JOB_FAILED"));
        assertTrue(n.shouldDeliver("DAILY_BRIEF"));
    }

    @Test
    void aBlankUrlDisablesTheWholeChannel() {
        WebhookNotifier n = notifier("", "feishu", "", "DAILY_BRIEF");
        assertFalse(n.shouldDeliver("DAILY_BRIEF"));
    }

    @Test
    void aMalformedUrlDisablesQuietly() {
        WebhookNotifier n = notifier("not a gate:way", "feishu", "", "DAILY_BRIEF");
        assertFalse(n.shouldDeliver("DAILY_BRIEF"));
    }

    // ── content safety ───────────────────────────────────────────────────────────

    @Test
    void longBodiesAreTruncatedToTheBotLimit() {
        String out = feishu().truncate("title", "x".repeat(10_000));
        assertTrue(out.length() <= WebhookNotifier.MAX_TEXT_CHARS, "must fit a strict bot limit");
        assertTrue(out.endsWith("…"), "truncation should be visible, not silent");
        assertTrue(out.startsWith("title"));
    }

    // ── DingTalk signing ─────────────────────────────────────────────────────────

    @Test
    void dingtalkSigningAppendsTimestampAndHmacSign() throws Exception {
        WebhookNotifier n = notifier("https://oapi.dingtalk.com/robot/send?access_token=t", "dingtalk",
                "secret", "DAILY_BRIEF");

        String signed = n.deliverUrl();

        assertTrue(signed.startsWith("https://oapi.dingtalk.com/robot/send?access_token=t&timestamp="));
        int q = signed.indexOf("&timestamp=");
        assertTrue(q > 0);
        long ts = Long.parseLong(signed.substring(q + 11, signed.indexOf('&', q + 11)));
        String signPart = signed.substring(signed.indexOf("&sign=") + 6);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] expected = mac.doFinal((ts + "\nsecret").getBytes(StandardCharsets.UTF_8));
        assertEquals(java.net.URLEncoder.encode(
                Base64.getEncoder().encodeToString(expected), StandardCharsets.UTF_8), signPart);
    }

    @Test
    void nonSignedTargetsGetTheBareUrl() {
        String url = base + "?token=t";
        assertEquals(url, notifier(url, "feishu", "secret", "DAILY_BRIEF").deliverUrl());
        assertEquals(url, notifier(url, "dingtalk", "", "DAILY_BRIEF").deliverUrl());
    }

    // ── the async front door ────────────────────────────────────────────────────

    @Test
    void pushOnTheWatchedTypeReachesTheServer() throws Exception {
        bodies.clear();
        status = 200;
        new WebhookNotifier(base, "feishu", "", "IMPORTANT_SIGNAL", 5000)
                .push("IMPORTANT_SIGNAL", "Important", "why");

        assertTrue(awaitNextBody().contains("Important"));
    }

    @Test
    void pushOfAnUnwatchedTypeSendsNothing() throws Exception {
        bodies.clear();
        new WebhookNotifier(base, "feishu", "", "DAILY_BRIEF", 5000)
                .push("JOB_FAILED", "t", "b");
        Thread.sleep(200);
        assertTrue(bodies.isEmpty(), "unwatched type must not reach the network");
    }
}
