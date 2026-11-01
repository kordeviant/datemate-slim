package geo

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

var PersianToEnglishCityMap = map[string]string{
	"تهران":       "Tehran",
	"مشهد":        "Mashhad",
	"اصفهان":      "Isfahan",
	"شیراز":       "Shiraz",
	"تبریز":       "Tabriz",
	"کرج":         "Karaj",
	"قم":          "Qom",
	"اهواز":       "Ahvaz",
	"کرمانشاه":    "Kermanshah",
	"ارومیه":      "Urmia",
	"رشت":         "Rasht",
	"زاهدان":      "Zahedan",
	"همدان":       "Hamadan",
	"کرمان":       "Kerman",
	"یزد":         "Yazd",
	"اردبیل":      "Ardabil",
	"بندرعباس":    "Bandar Abbas",
	"بندر عباس":   "Bandar Abbas",
	"اراک":        "Arak",
	"اسلامشهر":    "Eslamshahr",
	"اسلام شهر":   "Eslamshahr",
	"زنجان":       "Zanjan",
	"سنندج":       "Sanandaj",
	"قزوین":       "Qazvin",
	"خرم‌آباد":    "Khorramabad",
	"خرم اباد":    "Khorramabad",
	"گرگان":       "Gorgan",
	"ساری":        "Sari",
	"شهریار":      "Shahriar",
	"قدس":         "Qods",
	"شهر قدس":     "Qods",
	"کاشان":       "Kashan",
	"ملارد":       "Malard",
	"دزفول":       "Dezful",
	"نیشابور":     "Neyshabur",
	"بابل":        "Babol",
	"خمینی‌شهر":   "Khomeyni Shahr",
	"خمینی شهر":   "Khomeyni Shahr",
	"سبزوار":      "Sabzevar",
	"گلستان":      "Golestan",
	"آمل":         "Amol",
	"پاکدشت":      "Pakdasht",
	"نجف‌آباد":    "Najafabad",
	"نجف اباد":    "Najafabad",
	"بروجرد":      "Borujerd",
	"آبادان":      "Abadan",
	"قرچک":        "Qarchak",
	"بجنورد":      "Bojnurd",
	"ورامین":      "Varamin",
	"بوشهر":       "Bushehr",
	"ساوه":        "Saveh",
	"قائم‌شهر":    "Qaem Shahr",
	"قائم شهر":    "Qaem Shahr",
	"بیرجند":      "Birjand",
	"نسیم‌شهر":    "Nasim Shahr",
	"نسیم شهر":    "Nasim Shahr",
	"سیرجان":      "Sirjan",
	"خوی":         "Khoy",
	"ایلام":       "Ilam",
	"بوکان":       "Bukan",
	"شهرکرد":      "Shahr-e Kord",
	"سمنان":       "Semnan",
	"فردیس":       "Fardis",
	"مراغه":       "Maragheh",
	"شاهین‌شهر":   "Shahin Shahr",
	"شاهین شهر":   "Shahin Shahr",
	"مهاباد":      "Mahabad",
	"سقز":         "Saqqez",
}

func NormalizeCityQuery(input string) string {
	s := input
	s = strings.ReplaceAll(s, "\u200B", " ")
	s = strings.ReplaceAll(s, "\u200C", " ")
	s = strings.ReplaceAll(s, "\u200D", " ")
	s = strings.ReplaceAll(s, "\uFEFF", " ")
	s = strings.ReplaceAll(s, "ي", "ی")
	s = strings.ReplaceAll(s, "ك", "ک")
	return strings.TrimSpace(s)
}

type Country struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Code      string  `json:"code,omitempty"`
	Native    *string `json:"native,omitempty"`
	Emoji     *string `json:"emoji,omitempty"`
	PhoneCode string  `json:"phone_code,omitempty"`
}

type State struct {
	ID        int    `json:"id"`
	CountryID int    `json:"country_id"`
	Name      string `json:"name"`
	Code      string `json:"code,omitempty"`
}

type City struct {
	ID        int     `json:"id"`
	StateID   int     `json:"state_id"`
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude,omitempty"`
	Longitude float64 `json:"longitude,omitempty"`
}

type Service struct {
	mu           sync.RWMutex
	dataDir      string
	countries    []Country
	states       []State
	cities       []City
	cityByID     map[int]*City
	stateByID    map[int]*State
	countryByID  map[int]*Country
	statesByCID  map[int][]*State
	citiesBySID  map[int][]*City
	citiesByName map[string][]*City
}

func NewService(dataDir string) *Service {
	s := &Service{
		dataDir:      dataDir,
		cityByID:     make(map[int]*City),
		stateByID:    make(map[int]*State),
		countryByID:  make(map[int]*Country),
		statesByCID:  make(map[int][]*State),
		citiesBySID:  make(map[int][]*City),
		citiesByName: make(map[string][]*City),
	}

	_ = s.loadFromDir(dataDir)
	return s
}

func (s *Service) GetDataDir() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dataDir
}

func (s *Service) loadFromDir(dataDir string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	candidateDirs := []string{
		dataDir,
		"data/geo",
		"data",
		"/home/kord/.cache/datemate/data/geo",
	}

	var foundDir string
	for _, d := range candidateDirs {
		if _, err := os.Stat(filepath.Join(d, "countries.json")); err == nil {
			foundDir = d
			break
		}
	}

	if foundDir == "" {
		log.Println("Geo data files not found in candidate paths, skipping in-memory geo preloading.")
		return nil
	}
	s.dataDir = foundDir

	cData, err := os.ReadFile(filepath.Join(foundDir, "countries.json"))
	if err == nil {
		var list []Country
		if json.Unmarshal(cData, &list) == nil {
			s.countries = list
			for i := range s.countries {
				c := &s.countries[i]
				s.countryByID[c.ID] = c
			}
		}
	}

	sData, err := os.ReadFile(filepath.Join(foundDir, "states.json"))
	if err == nil {
		var list []State
		if json.Unmarshal(sData, &list) == nil {
			s.states = list
			for i := range s.states {
				st := &s.states[i]
				s.stateByID[st.ID] = st
				s.statesByCID[st.CountryID] = append(s.statesByCID[st.CountryID], st)
			}
		}
	}

	ctData, err := os.ReadFile(filepath.Join(foundDir, "cities.json"))
	if err == nil {
		var list []City
		if json.Unmarshal(ctData, &list) == nil {
			s.cities = list
			for i := range s.cities {
				ct := &s.cities[i]
				s.cityByID[ct.ID] = ct
				s.citiesBySID[ct.StateID] = append(s.citiesBySID[ct.StateID], ct)
				lower := strings.ToLower(ct.Name)
				s.citiesByName[lower] = append(s.citiesByName[lower], ct)
			}
		}
	}

	log.Printf("Loaded Geo in-memory dataset: %d countries, %d states, %d cities from %s",
		len(s.countries), len(s.states), len(s.cities), foundDir)
	return nil
}

func (s *Service) GetCity(id int) (*City, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.cityByID[id]
	return c, ok
}

func (s *Service) GetState(id int) (*State, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st, ok := s.stateByID[id]
	return st, ok
}

func (s *Service) GetCountry(id int) (*Country, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	co, ok := s.countryByID[id]
	return co, ok
}

func (s *Service) ResolveCityHierarchy(cityID int) (*City, *State, *Country, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, hasCity := s.cityByID[cityID]
	if !hasCity {
		return nil, nil, nil, false
	}

	st, _ := s.stateByID[c.StateID]
	var co *Country
	if st != nil {
		co = s.countryByID[st.CountryID]
	}

	return c, st, co, true
}

func (s *Service) ResolveCountry(idOrName string) *Country {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if id, err := strconv.Atoi(idOrName); err == nil {
		if c, ok := s.countryByID[id]; ok {
			return c
		}
	}
	clean := strings.ToLower(strings.TrimSpace(idOrName))
	for i := range s.countries {
		if strings.ToLower(s.countries[i].Name) == clean || strings.ToLower(s.countries[i].Code) == clean {
			return &s.countries[i]
		}
	}
	return nil
}

func (s *Service) ResolveState(idOrName string) *State {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if id, err := strconv.Atoi(idOrName); err == nil {
		if st, ok := s.stateByID[id]; ok {
			return st
		}
	}
	clean := strings.ToLower(strings.TrimSpace(idOrName))
	for i := range s.states {
		if strings.ToLower(s.states[i].Name) == clean || strings.ToLower(s.states[i].Code) == clean {
			return &s.states[i]
		}
	}
	return nil
}

func (s *Service) ResolveCity(idOrName string) *City {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if id, err := strconv.Atoi(idOrName); err == nil {
		if c, ok := s.cityByID[id]; ok {
			return c
		}
	}
	res := s.SearchCity(idOrName)
	if len(res) > 0 {
		return &res[0]
	}
	return nil
}

func (s *Service) GetCountries(search string) []Country {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if search == "" {
		res := make([]Country, len(s.countries))
		copy(res, s.countries)
		return res
	}
	clean := strings.ToLower(search)
	var res []Country
	for _, c := range s.countries {
		if strings.Contains(strings.ToLower(c.Name), clean) || strings.Contains(strings.ToLower(c.Code), clean) {
			res = append(res, c)
		}
	}
	return res
}

func (s *Service) GetStates(countryID int, search string) []State {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var base []*State
	if countryID > 0 {
		base = s.statesByCID[countryID]
	} else {
		for i := range s.states {
			base = append(base, &s.states[i])
		}
	}
	if search == "" {
		res := make([]State, 0, len(base))
		for _, st := range base {
			res = append(res, *st)
		}
		return res
	}
	clean := strings.ToLower(search)
	var res []State
	for _, st := range base {
		if strings.Contains(strings.ToLower(st.Name), clean) || strings.Contains(strings.ToLower(st.Code), clean) {
			res = append(res, *st)
		}
	}
	return res
}

func (s *Service) GetCities(stateID, countryID int, search string, limit, offset int) ([]City, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var base []*City
	if stateID > 0 {
		base = s.citiesBySID[stateID]
	} else if countryID > 0 {
		states := s.statesByCID[countryID]
		for _, st := range states {
			base = append(base, s.citiesBySID[st.ID]...)
		}
	} else {
		for i := range s.cities {
			base = append(base, &s.cities[i])
		}
	}

	cleanSearch := strings.ToLower(NormalizeCityQuery(search))
	if mapped, exists := PersianToEnglishCityMap[cleanSearch]; exists {
		cleanSearch = strings.ToLower(mapped)
	}

	var filtered []City
	for _, c := range base {
		if cleanSearch == "" || strings.Contains(strings.ToLower(c.Name), cleanSearch) {
			filtered = append(filtered, *c)
		}
	}

	total := len(filtered)
	if offset < 0 {
		offset = 0
	}
	if offset >= total {
		return []City{}, total
	}
	end := offset + limit
	if limit <= 0 || end > total {
		end = total
	}
	return filtered[offset:end], total
}

func (s *Service) GetCountryHierarchy(idOrName string) map[string]interface{} {
	country := s.ResolveCountry(idOrName)
	if country == nil {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	states := s.statesByCID[country.ID]
	stateList := make([]map[string]interface{}, 0, len(states))
	for _, st := range states {
		cities := s.citiesBySID[st.ID]
		cityList := make([]map[string]interface{}, 0, len(cities))
		for _, ct := range cities {
			cityList = append(cityList, map[string]interface{}{
				"id":   ct.ID,
				"name": ct.Name,
			})
		}
		stateList = append(stateList, map[string]interface{}{
			"id":     st.ID,
			"name":   st.Name,
			"cities": cityList,
		})
	}

	return map[string]interface{}{
		"country": country,
		"states":  stateList,
	}
}

func (s *Service) SearchCity(query string) []City {
	s.mu.RLock()
	defer s.mu.RUnlock()

	normalized := NormalizeCityQuery(query)
	searchTarget := normalized
	if mapped, exists := PersianToEnglishCityMap[normalized]; exists {
		searchTarget = mapped
	}

	targetLower := strings.ToLower(searchTarget)
	var matches []City

	// Exact matches first
	if exacts, found := s.citiesByName[targetLower]; found {
		for _, c := range exacts {
			matches = append(matches, *c)
		}
	}

	// Prefix matches
	if len(matches) < 20 {
		for name, list := range s.citiesByName {
			if strings.HasPrefix(name, targetLower) && name != targetLower {
				for _, c := range list {
					matches = append(matches, *c)
					if len(matches) >= 50 {
						break
					}
				}
			}
			if len(matches) >= 50 {
				break
			}
		}
	}

	return matches
}
