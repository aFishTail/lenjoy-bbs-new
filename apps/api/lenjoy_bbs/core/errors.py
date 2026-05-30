import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .logging import log_event
from .messages import ApiMessage, Common
from .responses import failure

logger = logging.getLogger("lenjoy_bbs.errors")


class ApiError(Exception):
    def __init__(self, message: ApiMessage):
        super().__init__(message.text)
        self.code = message.code
        self.message = message.text
        self.http_status = message.http_status


def install_error_handlers(app) -> None:
    def _response(request: Request, status_code: int, content: dict) -> JSONResponse:
        response = JSONResponse(status_code=status_code, content=content)
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(ApiError)
    def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        log_event(logger, logging.WARNING, "request.api_error", error_code=exc.code, status_code=exc.http_status)
        return _response(request, exc.http_status, failure(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        log_event(
            logger,
            logging.WARNING,
            "request.validation_error",
            errors=exc.errors(),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )
        return _response(
            request,
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=failure(Common.VALIDATION_ERROR.code, Common.VALIDATION_ERROR.text, details=exc.errors()),
        )

    @app.exception_handler(StarletteHTTPException)
    def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = Common.ROUTE_NOT_FOUND if exc.status_code == status.HTTP_404_NOT_FOUND else Common.HTTP_ERROR
        level = logging.INFO if exc.status_code == status.HTTP_404_NOT_FOUND else logging.WARNING
        log_event(logger, level, "request.http_error", error_code=message.code, status_code=exc.status_code)
        return _response(request, exc.status_code, failure(message.code, message.text))

    @app.exception_handler(Exception)
    def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return _response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            failure(Common.INTERNAL_SERVER_ERROR.code, Common.INTERNAL_SERVER_ERROR.text),
        )
