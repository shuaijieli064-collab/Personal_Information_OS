package com.signal.common;

import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.common.exceptions.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .findFirst().orElse("Invalid request");
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", msg);
    }

    /**
     * Malformed / unreadable request body (bad JSON, wrong content-type, empty body
     * where one is required). Without this it falls through to the catch-all and is
     * reported as a 500 — a client input error masquerading as a server fault.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Malformed or unreadable request body");
    }

    /**
     * Path/query parameter that cannot be bound (e.g. a non-UUID id in a UUID path
     * variable). This is a client error, not a server fault, so it must not 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String name = ex.getName();
        Class<?> required = ex.getRequiredType();
        String message = "Invalid value for '" + name + "'"
                + (required != null ? " (expected " + required.getSimpleName() + ")" : "");
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateResourceException ex) {
        return body(HttpStatus.CONFLICT, "DUPLICATE_RESOURCE", ex.getMessage());
    }

    @ExceptionHandler({BadCredentialsException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        return body(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuth(AuthenticationException ex) {
        return body(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ex.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleDenied(AccessDeniedException ex) {
        return body(HttpStatus.FORBIDDEN, "FORBIDDEN", "Access denied");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegal(IllegalArgumentException ex) {
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", ex.getMessage());
    }

    @ExceptionHandler(com.signal.ingestion.security.UrlValidator.BlockedUrlException.class)
    public ResponseEntity<ApiResponse<Void>> handleBlockedUrl(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "URL_BLOCKED", ex.getMessage());
    }

    @ExceptionHandler(com.signal.ingestion.pipeline.HttpFetcher.PayloadTooLargeException.class)
    public ResponseEntity<ApiResponse<Void>> handleTooLarge(Exception ex) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE", ex.getMessage());
    }

    @ExceptionHandler(com.signal.ingestion.pipeline.HttpFetcher.FetchFailedException.class)
    public ResponseEntity<ApiResponse<Void>> handleFetch(Exception ex) {
        return body(HttpStatus.BAD_GATEWAY, "URL_FETCH_FAILED", ex.getMessage());
    }

    @ExceptionHandler(com.signal.ingestion.service.IngestionService.SourceSyncException.class)
    public ResponseEntity<ApiResponse<Void>> handleSync(Exception ex) {
        return body(HttpStatus.BAD_GATEWAY, "SOURCE_SYNC_FAILED", ex.getMessage());
    }

    /**
     * Knowledge search depends on an external embedding provider. When it is down the
     * client must see a distinguishable failure, never an empty result that reads as
     * "nothing matched".
     */
    @ExceptionHandler(com.signal.knowledge.KnowledgeSearchService.SearchUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleSearchUnavailable(Exception ex) {
        return body(HttpStatus.BAD_GATEWAY, "SEARCH_UNAVAILABLE", ex.getMessage());
    }

    @ExceptionHandler(com.signal.ingestion.controller.ImportController.FileRejectedException.class)
    public ResponseEntity<ApiResponse<Void>> handleFile(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "FILE_INVALID", ex.getMessage());
    }

    /**
     * Unknown route — 404, not a server fault.
     *
     * <p>{@link NoHandlerFoundException} is the case when handler-mapping throws are enabled.
     * Spring Boot's default is the opposite: an unmapped path is handed to the static-resource
     * handler, which throws {@link NoResourceFoundException} instead — so without the second
     * handler below an unknown API path (e.g. a client calling a renamed endpoint) falls
     * through to the catch-all and is reported as a 500.
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoHandler(NoHandlerFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND",
                "No handler for " + ex.getHttpMethod() + " " + ex.getRequestURL());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND",
                "No handler for " + ex.getHttpMethod() + " " + ex.getResourcePath());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
        // The catch-all must never swallow the stack trace. Without it a 500 is
        // unattributable in both server logs and client UIs — the message alone
        // ("Something went wrong") cannot be correlated with a cause.
        log.error("Unhandled exception", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong");
    }

    private ResponseEntity<ApiResponse<Void>> body(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(ApiResponse.fail(code, message));
    }
}
