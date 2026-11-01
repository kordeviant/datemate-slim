import { ArgumentsHost, HttpException, HttpStatus, Logger, UnauthorizedException } from "@nestjs/common";
import {
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "@nestjs/jwt";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { CallbackErrorTypes } from "../dtos/response-result.dto";

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: "PUT",
      url: "/v1/users/profile",
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should catch TokenExpiredError and return 401 with Access token has expired", () => {
    const error = new TokenExpiredError("jwt expired", new Date());

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Access token has expired",
      data: null,
      error: {
        type: CallbackErrorTypes.UNKNOWN_ERROR,
        message: "Access token has expired",
      },
    });
  });

  it("should catch JsonWebTokenError and return 401 with Invalid access token", () => {
    const error = new JsonWebTokenError("invalid signature");

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Invalid access token",
      data: null,
      error: {
        type: CallbackErrorTypes.UNKNOWN_ERROR,
        message: "Invalid access token",
      },
    });
  });

  it("should catch NotBeforeError and return 401 with Invalid access token", () => {
    const error = new NotBeforeError("jwt not active", new Date());

    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Invalid access token",
      data: null,
      error: {
        type: CallbackErrorTypes.UNKNOWN_ERROR,
        message: "Invalid access token",
      },
    });
  });

  it("should handle UnauthorizedException and return 401", () => {
    const exception = new UnauthorizedException("Access token has expired");

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Access token has expired",
      data: null,
      error: {
        type: CallbackErrorTypes.UNKNOWN_ERROR,
        message: "Access token has expired",
      },
    });
  });

  it("should return 500 with Internal server error for unexpected Error without exposing sensitive details", () => {
    const unexpectedError = new Error("Database password leaked in connection string");

    filter.catch(unexpectedError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Internal server error",
      data: null,
      error: {
        type: CallbackErrorTypes.UNKNOWN_ERROR,
        message: "Internal server error",
      },
    });
  });

  it("should preserve HttpException details and custom error types", () => {
    const exception = new HttpException(
      {
        message: "Invalid username",
        errorType: CallbackErrorTypes.BIO_INVALID,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: "error",
      message: "Invalid username",
      data: null,
      error: {
        type: CallbackErrorTypes.BIO_INVALID,
        message: "Invalid username",
      },
    });
  });
});
