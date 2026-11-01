package users

import (
	"encoding/json"
	"testing"
)

func TestUserDevicesResponseDto_Serialization(t *testing.T) {
	devInfo := "iPhone 15 Pro, iOS 17.4"
	fcmToken := "fcm_token_xyz"
	expiresAt := "2026-11-14T10:00:00.000Z"
	createdAt := "2026-10-14T10:00:00.000Z"

	item := UserDeviceItemDto{
		ID:         1,
		DeviceInfo: &devInfo,
		FcmToken:   &fcmToken,
		IsActive:   true,
		IsCurrent:  true,
		CreatedAt:  createdAt,
		ExpiresAt:  &expiresAt,
	}

	dto := UserDevicesResponseDto{
		Devices:         []UserDeviceItemDto{item},
		ActiveDevices:   []UserDeviceItemDto{item},
		InactiveDevices: []UserDeviceItemDto{},
		Total:           1,
		ActiveCount:     1,
		InactiveCount:   0,
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal UserDevicesResponseDto: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if raw["total"] != float64(1) || raw["activeCount"] != float64(1) || raw["inactiveCount"] != float64(0) {
		t.Errorf("unexpected counts: total=%v, active=%v, inactive=%v", raw["total"], raw["activeCount"], raw["inactiveCount"])
	}

	activeDevs, ok := raw["activeDevices"].([]interface{})
	if !ok || len(activeDevs) != 1 {
		t.Fatalf("expected activeDevices array of length 1, got %v", raw["activeDevices"])
	}

	d0 := activeDevs[0].(map[string]interface{})
	if d0["isActive"] != true || d0["isCurrent"] != true {
		t.Errorf("expected isActive=true and isCurrent=true, got %v, %v", d0["isActive"], d0["isCurrent"])
	}
	if d0["deviceInfo"] != devInfo {
		t.Errorf("expected deviceInfo %s, got %v", devInfo, d0["deviceInfo"])
	}
	if d0["fcmToken"] != fcmToken {
		t.Errorf("expected fcmToken %s, got %v", fcmToken, d0["fcmToken"])
	}
}
