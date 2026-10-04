package com.signal.ingestion.controller;

import com.signal.common.ApiResponse;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.pipeline.HttpFetcher;
import com.signal.ingestion.pipeline.NormalizedItem;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.ingestion.security.UrlValidator;
import com.signal.ingestion.service.IngestionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.jsoup.Jsoup;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/import")
public class ImportController {

    private static final Set<String> ALLOWED_EXT = Set.of("txt", "md", "pdf");

    private final UrlValidator validator;
    private final HttpFetcher fetcher;
    private final SourceRepository sources;
    private final IngestionService ingestion;

    public ImportController(UrlValidator validator, HttpFetcher fetcher,
                            SourceRepository sources, IngestionService ingestion) {
        this.validator = validator;
        this.fetcher = fetcher;
        this.sources = sources;
        this.ingestion = ingestion;
    }

    public record UrlImportRequest(@NotBlank String url) {}

    @PostMapping("/url")
    public ApiResponse<Map<String, Object>> importUrl(@Valid @RequestBody UrlImportRequest req) throws IOException {
        validator.validate(req.url());
        byte[] body = fetcher.get(req.url());
        String html = new String(body, StandardCharsets.UTF_8);
        var doc = Jsoup.parse(html, req.url());
        String title = doc.title() == null || doc.title().isBlank() ? "Untitled" : doc.title().trim();
        var main = doc.selectFirst("article");
        if (main == null) main = doc.body();
        String text = main == null ? Jsoup.clean(html, org.jsoup.safety.Safelist.none())
                : Jsoup.clean(main.html(), org.jsoup.safety.Safelist.none());

        Source s = transientSource("URL", req.url());
        ingestion.persistDirect(s, new NormalizedItem(
                com.signal.ingestion.pipeline.Hashing.canonicalUrl(req.url()),
                title, text, excerpt(text), req.url(), null, null, "ARTICLE", null, Map.of()));
        return ApiResponse.ok(Map.of("imported", true, "title", title));
    }

    @PostMapping("/file")
    public ApiResponse<Map<String, Object>> importFile(@RequestParam("file") MultipartFile file) throws IOException {
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1) : "";
        if (!ALLOWED_EXT.contains(ext)) throw new FileRejectedException("Unsupported file type");
        if (file.isEmpty()) throw new FileRejectedException("Empty file");

        String text; String type;
        if (ext.equals("pdf")) {
            try (PDDocument pdf = Loader.loadPDF(file.getBytes())) {
                text = new PDFTextStripper().getText(pdf);
            }
            type = "DOCUMENT";
        } else {
            text = new String(file.getBytes(), StandardCharsets.UTF_8);
            type = "DOCUMENT";
        }
        if (text.isBlank()) throw new FileRejectedException("No extractable text (scanned PDF is not OCR'd)");

        Source s = transientSource("FILE", null);
        ingestion.persistDirect(s, new NormalizedItem(
                "file:" + file.hashCode() + ":" + original,
                original.isBlank() ? "Untitled" : original,
                text, excerpt(text), null, null, null, type, null, Map.of("filename", original)));
        return ApiResponse.ok(Map.of("imported", true, "title", original));
    }

    private Source transientSource(String type, String url) {
        Source s = new Source();
        s.setUserId(userId());
        s.setType(type);
        s.setName(type + " import");
        s.setUrl(url);
        s.setStatus("ACTIVE");
        return sources.save(s);
    }

    private static String excerpt(String t) {
        return t == null ? "" : (t.length() > 280 ? t.substring(0, 280) : t);
    }

    public static class FileRejectedException extends RuntimeException {
        public FileRejectedException(String m) { super(m); }
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
