package geo

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
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
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	PhoneCode string `json:"phone_code,omitempty"`
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

func (s *Service) ResolveCityHierarchy(cityID int) (cityName, stateName, countryName string, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, hasCity := s.cityByID[cityID]
	if !hasCity {
		return "", "", "", false
	}
	cityName = c.Name

	st, hasState := s.stateByID[c.StateID]
	if hasState {
		stateName = st.Name
		if co, hasCountry := s.countryByID[st.CountryID]; hasCountry {
			countryName = co.Name
		}
	}

	return cityName, stateName, countryName, true
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
