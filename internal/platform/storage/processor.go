package storage

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

type ProcessOptions struct {
	IsAvatarOrSelfie bool
	Quality          float32
}

// ProcessImage decodes the image, handles EXIF auto-orientation, resizes if needed, and encodes to WebP
func ProcessImage(input []byte, opts ProcessOptions) ([]byte, string, error) {
	reader := bytes.NewReader(input)
	img, err := imaging.Decode(reader, imaging.AutoOrientation(true))
	if err != nil {
		return nil, "", fmt.Errorf("unable to decode image: %w", err)
	}

	var processed image.Image = img
	if opts.IsAvatarOrSelfie {
		// 1080x1080 center cover crop
		processed = imaging.Fill(img, 1080, 1080, imaging.Center, imaging.Lanczos)
	} else {
		// If width or height exceeds 2048, resize preserving aspect ratio
		bounds := img.Bounds()
		w := bounds.Dx()
		h := bounds.Dy()
		if w > 2048 || h > 2048 {
			processed = imaging.Fit(img, 2048, 2048, imaging.Lanczos)
		}
	}

	quality := opts.Quality
	if quality <= 0 {
		quality = 85
	}

	var buf bytes.Buffer
	if err := webp.Encode(&buf, processed, &webp.Options{Quality: quality}); err != nil {
		return nil, "", fmt.Errorf("unable to encode webp: %w", err)
	}

	return buf.Bytes(), "image/webp", nil
}
