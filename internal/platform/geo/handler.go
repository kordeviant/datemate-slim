package geo

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

var sanitizeRegexp = regexp.MustCompile(`[^a-z0-9_\-]+`)

func sanitizeFilename(name string) string {
	if name == "" {
		return "data"
	}
	clean := strings.ToLower(name)
	clean = sanitizeRegexp.ReplaceAllString(clean, "_")
	return strings.Trim(clean, "_")
}

func handleDownloadHeaders(w http.ResponseWriter, r *http.Request, filename string) {
	if r.URL.Query().Get("download") == "true" || r.URL.Query().Get("attachment") == "true" {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	}
}

type DownloadPackage struct {
	ID                    string   `json:"id"`
	Name                  string   `json:"name"`
	Category              string   `json:"category"`
	Description           string   `json:"description"`
	Format                string   `json:"format"`
	DownloadURL           string   `json:"downloadUrl"`
	APIURL                string   `json:"apiUrl"`
	SizeBytes             int64    `json:"sizeBytes"`
	UpdatedAt             string   `json:"updatedAt"`
	ScalableFilterSupport []string `json:"scalableFilterSupport,omitempty"`
	Examples              []string `json:"examples,omitempty"`
}

type DownloadCatalog struct {
	Version       string            `json:"version"`
	TotalPackages int               `json:"totalPackages"`
	Categories    []string          `json:"categories"`
	Items         []DownloadPackage `json:"items"`
}

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	// Geo endpoints
	r.Route("/geo", func(gr chi.Router) {
		gr.Get("/countries", h.GetCountries)
		gr.Get("/countries/{idOrName}", h.GetCountry)
		gr.Get("/countries/{idOrName}/states", h.GetCountryStates)
		gr.Get("/countries/{idOrName}/cities", h.GetCountryCities)
		gr.Get("/countries/{idOrName}/hierarchy", h.GetCountryHierarchy)

		gr.Get("/states", h.GetStates)
		gr.Get("/states/{idOrName}", h.GetState)
		gr.Get("/states/{idOrName}/cities", h.GetStateCities)

		gr.Get("/cities", h.GetCities)
		gr.Get("/cities/{idOrName}", h.GetCity)
	})

	// Download endpoints
	r.Route("/downloads", func(dr chi.Router) {
		dr.Get("/", h.GetCatalog)
		dr.Get("/catalog", h.GetCatalog)
		dr.Get("/raw/{filename}", h.GetRawFile)
		dr.Get("/countries", h.DownloadCountries)
		dr.Get("/states", h.DownloadStates)
		dr.Get("/cities", h.DownloadCities)
		dr.Get("/hierarchy", h.DownloadHierarchy)
		dr.Get("/package/{id}", h.DownloadPackage)
	})
}

func (h *Handler) GetCountries(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	envelope := r.URL.Query().Get("envelope")

	list := h.svc.GetCountries(search)
	w.Header().Set("X-Total-Count", strconv.Itoa(len(list)))

	filename := "countries.json"
	if search != "" {
		filename = fmt.Sprintf("countries_%s.json", sanitizeFilename(search))
	}
	handleDownloadHeaders(w, r, filename)

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"total":     len(list),
			"search":    search,
			"countries": list,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(list)
}

func (h *Handler) GetCountry(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	country := h.svc.ResolveCountry(idOrName)
	if country == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Country not found",
			"query": idOrName,
		})
		return
	}

	handleDownloadHeaders(w, r, fmt.Sprintf("country_%s.json", sanitizeFilename(country.Name)))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(country)
}

func (h *Handler) GetCountryStates(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	search := r.URL.Query().Get("search")
	envelope := r.URL.Query().Get("envelope")

	country := h.svc.ResolveCountry(idOrName)
	if country == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Country not found",
			"query": idOrName,
		})
		return
	}

	states := h.svc.GetStates(country.ID, search)
	w.Header().Set("X-Total-Count", strconv.Itoa(len(states)))
	w.Header().Set("X-Country-Id", strconv.Itoa(country.ID))
	w.Header().Set("X-Country-Name", country.Name)

	handleDownloadHeaders(w, r, fmt.Sprintf("states_%s.json", sanitizeFilename(country.Name)))

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"country": map[string]interface{}{"id": country.ID, "name": country.Name},
			"total":   len(states),
			"states":  states,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(states)
}

func (h *Handler) GetCountryCities(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	search := r.URL.Query().Get("search")
	envelope := r.URL.Query().Get("envelope")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	country := h.svc.ResolveCountry(idOrName)
	if country == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Country not found",
			"query": idOrName,
		})
		return
	}

	if limit <= 0 {
		limit = 100
	}

	cities, total := h.svc.GetCities(0, country.ID, search, limit, offset)
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-Country-Id", strconv.Itoa(country.ID))
	w.Header().Set("X-Country-Name", country.Name)

	handleDownloadHeaders(w, r, fmt.Sprintf("cities_%s.json", sanitizeFilename(country.Name)))

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"country": map[string]interface{}{"id": country.ID, "name": country.Name},
			"total":   total,
			"offset":  offset,
			"limit":   limit,
			"cities":  cities,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(cities)
}

func (h *Handler) GetCountryHierarchy(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	asArray := r.URL.Query().Get("asArray")

	hierarchy := h.svc.GetCountryHierarchy(idOrName)
	if hierarchy == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Country not found for hierarchy",
			"query": idOrName,
		})
		return
	}

	country, _ := hierarchy["country"].(*Country)
	if country != nil {
		w.Header().Set("X-Country-Id", strconv.Itoa(country.ID))
		w.Header().Set("X-Country-Name", country.Name)
		handleDownloadHeaders(w, r, fmt.Sprintf("hierarchy_%s.json", sanitizeFilename(country.Name)))
	}

	w.Header().Set("Content-Type", "application/json")
	if asArray == "true" {
		_ = json.NewEncoder(w).Encode([]interface{}{hierarchy})
		return
	}

	_ = json.NewEncoder(w).Encode(hierarchy)
}

func (h *Handler) GetStates(w http.ResponseWriter, r *http.Request) {
	countryIDStr := r.URL.Query().Get("countryId")
	countryStr := r.URL.Query().Get("country")
	search := r.URL.Query().Get("search")
	envelope := r.URL.Query().Get("envelope")

	var targetCountry *Country
	if countryIDStr != "" || countryStr != "" {
		lookup := countryIDStr
		if lookup == "" {
			lookup = countryStr
		}
		targetCountry = h.svc.ResolveCountry(lookup)
		if targetCountry == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Country not found",
				"query": lookup,
			})
			return
		}
	}

	cID := 0
	if targetCountry != nil {
		cID = targetCountry.ID
	}

	states := h.svc.GetStates(cID, search)
	w.Header().Set("X-Total-Count", strconv.Itoa(len(states)))

	filename := "states.json"
	if targetCountry != nil {
		w.Header().Set("X-Country-Id", strconv.Itoa(targetCountry.ID))
		w.Header().Set("X-Country-Name", targetCountry.Name)
		filename = fmt.Sprintf("states_%s.json", sanitizeFilename(targetCountry.Name))
	}
	handleDownloadHeaders(w, r, filename)

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		resp := map[string]interface{}{
			"total":  len(states),
			"states": states,
		}
		if targetCountry != nil {
			resp["country"] = map[string]interface{}{"id": targetCountry.ID, "name": targetCountry.Name}
		}
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	_ = json.NewEncoder(w).Encode(states)
}

func (h *Handler) GetState(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	state := h.svc.ResolveState(idOrName)
	if state == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "State not found",
			"query": idOrName,
		})
		return
	}

	handleDownloadHeaders(w, r, fmt.Sprintf("state_%s.json", sanitizeFilename(state.Name)))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(state)
}

func (h *Handler) GetStateCities(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	search := r.URL.Query().Get("search")
	envelope := r.URL.Query().Get("envelope")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	state := h.svc.ResolveState(idOrName)
	if state == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "State not found",
			"query": idOrName,
		})
		return
	}

	if limit <= 0 {
		limit = 100
	}

	cities, total := h.svc.GetCities(state.ID, 0, search, limit, offset)
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-State-Id", strconv.Itoa(state.ID))
	w.Header().Set("X-State-Name", state.Name)

	handleDownloadHeaders(w, r, fmt.Sprintf("cities_%s.json", sanitizeFilename(state.Name)))

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"state":  map[string]interface{}{"id": state.ID, "name": state.Name, "countryId": state.CountryID},
			"total":  total,
			"offset": offset,
			"limit":  limit,
			"cities": cities,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(cities)
}

func (h *Handler) GetCity(w http.ResponseWriter, r *http.Request) {
	idOrName := chi.URLParam(r, "idOrName")
	city := h.svc.ResolveCity(idOrName)
	if city == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "City not found",
			"query": idOrName,
		})
		return
	}

	c, st, co, _ := h.svc.ResolveCityHierarchy(city.ID)
	handleDownloadHeaders(w, r, fmt.Sprintf("city_%s.json", sanitizeFilename(city.Name)))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        c.ID,
		"name":      c.Name,
		"stateId":   c.StateID,
		"countryId": func() *int { if co != nil { return &co.ID }; return nil }(),
		"state":     st,
		"country":   co,
	})
}

func (h *Handler) GetCities(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		idStr = r.URL.Query().Get("cityId")
	}

	if idStr != "" {
		city := h.svc.ResolveCity(idStr)
		if city == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "City not found",
				"query": idStr,
			})
			return
		}
		c, st, co, _ := h.svc.ResolveCityHierarchy(city.ID)
		handleDownloadHeaders(w, r, fmt.Sprintf("city_%s.json", sanitizeFilename(city.Name)))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":        c.ID,
			"name":      c.Name,
			"stateId":   c.StateID,
			"countryId": func() *int { if co != nil { return &co.ID }; return nil }(),
			"state":     st,
			"country":   co,
		})
		return
	}

	search := r.URL.Query().Get("search")
	stateID, _ := strconv.Atoi(r.URL.Query().Get("stateId"))
	stateStr := r.URL.Query().Get("state")
	countryID, _ := strconv.Atoi(r.URL.Query().Get("countryId"))
	countryStr := r.URL.Query().Get("country")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	envelope := r.URL.Query().Get("envelope")

	if stateID == 0 && stateStr != "" {
		if st := h.svc.ResolveState(stateStr); st != nil {
			stateID = st.ID
		}
	}
	if countryID == 0 && countryStr != "" {
		if co := h.svc.ResolveCountry(countryStr); co != nil {
			countryID = co.ID
		}
	}

	if limit <= 0 {
		limit = 100
	}

	cities, total := h.svc.GetCities(stateID, countryID, search, limit, offset)
	w.Header().Set("X-Total-Count", strconv.Itoa(total))

	fileLabel := "cities"
	if stateID > 0 {
		if st, ok := h.svc.GetState(stateID); ok {
			fileLabel = fmt.Sprintf("cities_%s", sanitizeFilename(st.Name))
			w.Header().Set("X-State-Id", strconv.Itoa(st.ID))
		}
	} else if countryID > 0 {
		if co, ok := h.svc.GetCountry(countryID); ok {
			fileLabel = fmt.Sprintf("cities_%s", sanitizeFilename(co.Name))
			w.Header().Set("X-Country-Id", strconv.Itoa(co.ID))
		}
	}
	handleDownloadHeaders(w, r, fmt.Sprintf("%s.json", fileLabel))

	w.Header().Set("Content-Type", "application/json")
	if envelope == "true" {
		resp := map[string]interface{}{
			"total":  total,
			"offset": offset,
			"limit":  limit,
			"cities": cities,
		}
		if stateID > 0 {
			if st, ok := h.svc.GetState(stateID); ok {
				resp["state"] = map[string]interface{}{"id": st.ID, "name": st.Name}
			}
		}
		if countryID > 0 {
			if co, ok := h.svc.GetCountry(countryID); ok {
				resp["country"] = map[string]interface{}{"id": co.ID, "name": co.Name}
			}
		}
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	_ = json.NewEncoder(w).Encode(cities)
}

func (h *Handler) getPackages() []DownloadPackage {
	dataDir := h.svc.GetDataDir()
	statFile := func(name string) (int64, string) {
		p := filepath.Join(dataDir, name)
		if fi, err := os.Stat(p); err == nil {
			return fi.Size(), fi.ModTime().UTC().Format("2006-01-02T15:04:05Z07:00")
		}
		return 0, ""
	}

	cSize, cUp := statFile("countries.json")
	sSize, sUp := statFile("states.json")
	ctSize, ctUp := statFile("cities.json")
	hSize, hUp := statFile("countries_states_cities.json")

	return []DownloadPackage{
		{
			ID:                    "countries",
			Name:                  "All Countries",
			Category:              "geo",
			Description:           "Complete list of 250 countries formatted for client models",
			Format:                "json",
			DownloadURL:           "/v1/downloads/raw/countries.json",
			APIURL:                "/v1/geo/countries",
			SizeBytes:             cSize,
			UpdatedAt:             cUp,
			ScalableFilterSupport: []string{"search"},
		},
		{
			ID:                    "states",
			Name:                  "All States & Provinces",
			Category:              "geo",
			Description:           "Complete list of 5,308 states/provinces worldwide",
			Format:                "json",
			DownloadURL:           "/v1/downloads/raw/states.json",
			APIURL:                "/v1/geo/states",
			SizeBytes:             sSize,
			UpdatedAt:             sUp,
			ScalableFilterSupport: []string{"countryId", "country", "search"},
			Examples: []string{
				"/v1/geo/countries/233/states?download=true",
				"/v1/geo/states?country=United States&download=true",
			},
		},
		{
			ID:                    "cities",
			Name:                  "All Cities",
			Category:              "geo",
			Description:           "Complete list of 152,970 global cities with stateId and countryId",
			Format:                "json",
			DownloadURL:           "/v1/downloads/raw/cities.json",
			APIURL:                "/v1/geo/cities",
			SizeBytes:             ctSize,
			UpdatedAt:             ctUp,
			ScalableFilterSupport: []string{"stateId", "state", "countryId", "country", "search", "limit", "offset"},
			Examples: []string{
				"/v1/geo/states/1456/cities?download=true",
				"/v1/geo/cities?state=Alabama&download=true",
				"/v1/geo/countries/233/cities?download=true",
			},
		},
		{
			ID:                    "hierarchy",
			Name:                  "Countries States Cities Hierarchy",
			Category:              "geo",
			Description:           "Complete nested hierarchical dataset (Country -> State -> City)",
			Format:                "json",
			DownloadURL:           "/v1/downloads/raw/countries_states_cities.json",
			APIURL:                "/v1/geo/countries/:countryId/hierarchy",
			SizeBytes:             hSize,
			UpdatedAt:             hUp,
			ScalableFilterSupport: []string{"countryId", "country"},
			Examples: []string{
				"/v1/geo/countries/233/hierarchy?download=true",
				"/v1/geo/countries/United States/hierarchy?download=true",
			},
		},
	}
}

func (h *Handler) GetCatalog(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	pkgs := h.getPackages()

	if category != "" {
		var filtered []DownloadPackage
		for _, p := range pkgs {
			if p.Category == category {
				filtered = append(filtered, p)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"category": category,
			"total":    len(filtered),
			"items":    filtered,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(DownloadCatalog{
		Version:       "1.0.0",
		TotalPackages: len(pkgs),
		Categories:    []string{"geo"},
		Items:         pkgs,
	})
}

func (h *Handler) GetRawFile(w http.ResponseWriter, r *http.Request) {
	filename := filepath.Base(chi.URLParam(r, "filename"))
	filePath := filepath.Join(h.svc.GetDataDir(), filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "File not found",
			"file":  filename,
		})
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeFile(w, r, filePath)
}

func (h *Handler) DownloadCountries(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	list := h.svc.GetCountries(search)
	filename := "countries.json"
	if search != "" {
		filename = fmt.Sprintf("countries_%s.json", sanitizeFilename(search))
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(list)
}

func (h *Handler) DownloadStates(w http.ResponseWriter, r *http.Request) {
	countryIDStr := r.URL.Query().Get("countryId")
	countryStr := r.URL.Query().Get("country")
	search := r.URL.Query().Get("search")

	cID := 0
	filename := "states.json"
	if countryIDStr != "" || countryStr != "" {
		lookup := countryIDStr
		if lookup == "" {
			lookup = countryStr
		}
		if co := h.svc.ResolveCountry(lookup); co != nil {
			cID = co.ID
			filename = fmt.Sprintf("states_%s.json", sanitizeFilename(co.Name))
			w.Header().Set("X-Country-Id", strconv.Itoa(co.ID))
		}
	}

	states := h.svc.GetStates(cID, search)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(states)
}

func (h *Handler) DownloadCities(w http.ResponseWriter, r *http.Request) {
	stateID, _ := strconv.Atoi(r.URL.Query().Get("stateId"))
	countryID, _ := strconv.Atoi(r.URL.Query().Get("countryId"))
	search := r.URL.Query().Get("search")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 {
		limit = 1000000
	}

	cities, _ := h.svc.GetCities(stateID, countryID, search, limit, offset)
	filename := "cities.json"
	if stateID > 0 {
		if st, ok := h.svc.GetState(stateID); ok {
			filename = fmt.Sprintf("cities_%s.json", sanitizeFilename(st.Name))
			w.Header().Set("X-State-Id", strconv.Itoa(st.ID))
		}
	} else if countryID > 0 {
		if co, ok := h.svc.GetCountry(countryID); ok {
			filename = fmt.Sprintf("cities_%s.json", sanitizeFilename(co.Name))
			w.Header().Set("X-Country-Id", strconv.Itoa(co.ID))
		}
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(cities)
}

func (h *Handler) DownloadHierarchy(w http.ResponseWriter, r *http.Request) {
	countryIDStr := r.URL.Query().Get("countryId")
	countryStr := r.URL.Query().Get("country")

	lookup := countryIDStr
	if lookup == "" {
		lookup = countryStr
	}

	if lookup != "" {
		hierarchy := h.svc.GetCountryHierarchy(lookup)
		if hierarchy == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Country not found",
				"query": lookup,
			})
			return
		}
		co, _ := hierarchy["country"].(*Country)
		filename := "hierarchy.json"
		if co != nil {
			filename = fmt.Sprintf("hierarchy_%s.json", sanitizeFilename(co.Name))
		}
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		w.Header().Set("Content-Type", "application/json")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		_ = enc.Encode(hierarchy)
		return
	}

	filePath := filepath.Join(h.svc.GetDataDir(), "countries_states_cities.json")
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "File not found",
		})
		return
	}

	w.Header().Set("Content-Disposition", `attachment; filename="countries_states_cities.json"`)
	http.ServeFile(w, r, filePath)
}

func (h *Handler) DownloadPackage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	pkgs := h.getPackages()

	var matched *DownloadPackage
	for _, p := range pkgs {
		if p.ID == id {
			matched = &p
			break
		}
	}

	if matched == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     "Package not found in registry",
			"packageId": id,
		})
		return
	}

	filename := filepath.Base(matched.DownloadURL)
	filePath := filepath.Join(h.svc.GetDataDir(), filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "File not found",
			"file":  filename,
		})
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeFile(w, r, filePath)
}
