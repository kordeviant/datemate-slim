package common

import (
	"fmt"
	"time"
)

func GetBucket(t time.Time) string {
	if t.IsZero() {
		t = time.Now().UTC()
	} else {
		t = t.UTC()
	}
	return fmt.Sprintf("%04d%02d%02d", t.Year(), t.Month(), t.Day())
}

func GetPreviousBucket(bucket string) string {
	if len(bucket) != 8 {
		return GetBucket(time.Now().UTC().AddDate(0, 0, -1))
	}
	t, err := time.Parse("20060102", bucket)
	if err != nil {
		return GetBucket(time.Now().UTC().AddDate(0, 0, -1))
	}
	prev := t.AddDate(0, 0, -1)
	return GetBucket(prev)
}

func IsBucketOlderThan(bucketA, bucketB string) bool {
	return bucketA < bucketB
}
