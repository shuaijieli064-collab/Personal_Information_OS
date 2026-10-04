package com.signal.common;

import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.common.exceptions.ResourceNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .findFirst().orElse("Invalid request");
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", msg);
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

    @ExceptionHandler(com.signal.ingestion.controller.ImportController.FileRejectedException.class)
    public ResponseEntity<ApiResponse<Void>> handleFile(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "FILE_INVALID", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong");
    }

    private ResponseEntity<ApiResponse<Void>> body(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(ApiResponse.fail(code, message));
    }
}
