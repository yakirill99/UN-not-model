"""Service errors; the API maps them to HTTP status codes."""


class ServiceError(Exception):
    status_code = 400


class NotFound(ServiceError):
    status_code = 404


class Forbidden(ServiceError):
    status_code = 403


class Conflict(ServiceError):
    status_code = 409


class InvalidInput(ServiceError):
    status_code = 422
