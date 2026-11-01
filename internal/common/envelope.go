package common

import (
	"encoding/json"
	"net/http"
)

type CallbackError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type AppError struct {
	HTTPStatus int    `json:"-"`
	Type       string `json:"type"`
	Message    string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(httpStatus int, errType, message string) *AppError {
	return &AppError{
		HTTPStatus: httpStatus,
		Type:       errType,
		Message:    message,
	}
}

type ResponseResult[T any] struct {
	Status  string         `json:"status"`
	Message string         `json:"message"`
	Data    T              `json:"data"`
	Error   *CallbackError `json:"error"`
}

const (
	StatusSuccess = "success"
	StatusError   = "error"
)

const (
	ErrFirstNameInvalid        = "FIRST_NAME_INVALID"
	ErrLastNameInvalid         = "LAST_NAME_INVALID"
	ErrAgeTooLow               = "AGE_TOO_LOW"
	ErrAgeTooHigh              = "AGE_TOO_HIGH"
	ErrBioInvalid              = "BIO_INVALID"
	ErrHeightInvalid           = "HEIGHT_INVALID"
	ErrWeightInvalid           = "WEIGHT_INVALID"
	ErrProfilePictureTooLarge  = "PROFILE_PICTURE_TOO_LARGE"
	ErrSelfieTooLarge          = "SELFIE_TOO_LARGE"
	ErrProfessionInvalid       = "PROFESSION_INVALID"
	ErrQuestionsNotAnswered    = "QUESTIONS_NOT_ANSWERED"
	ErrSelfieMissing           = "SELFIE_MISSING"
	ErrSelfieNotApproved       = "SELFIE_NOT_APPROVED"
	ErrNotPremium              = "NOT_PREMIUM"
	ErrMessageCountRestricted  = "MESSAGE_COUNT_RESTRICTED"
	ErrDirectCountRestricted   = "DIRECT_COUNT_RESTRICTED"
	ErrProfilePictureMissing   = "PROFILE_PICTURE_MISSING"
	ErrBlocked                 = "BLOCKED"
	ErrBanned                  = "BANNED"
	ErrAttachmentNSFW          = "ATTACHMENT_NSFW"
	ErrUnknownError            = "UNKNOWN_ERROR"
	ErrUnauthorized            = "UNAUTHORIZED"
	ErrForbidden               = "FORBIDDEN"
	ErrNotFound                = "NOT_FOUND"
	ErrBadRequest              = "BAD_REQUEST"
	ErrInvalidCursor           = "INVALID_CURSOR"
)

func RespondSuccess[T any](w http.ResponseWriter, statusCode int, message string, data T) {
	if message == "" {
		message = "Operation successful"
	}
	res := ResponseResult[T]{
		Status:  StatusSuccess,
		Message: message,
		Data:    data,
		Error:   nil,
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(res)
}

func RespondError(w http.ResponseWriter, statusCode int, message, errType string) {
	if errType == "" {
		errType = ErrUnknownError
	}
	res := ResponseResult[any]{
		Status:  StatusError,
		Message: message,
		Data:    nil,
		Error: &CallbackError{
			Type:    errType,
			Message: message,
		},
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(res)
}

func RespondAppError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*AppError); ok {
		RespondError(w, appErr.HTTPStatus, appErr.Message, appErr.Type)
		return
	}
	RespondError(w, http.StatusInternalServerError, err.Error(), ErrUnknownError)
}
