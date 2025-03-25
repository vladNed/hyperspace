package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"math/big"
)

var (
	adjectives = []string{
		"distinct", "better", "easy", "acrid", "merciful", "infamous", "lonely", "nine",
		"violet", "fluttering", "common", "great", "exuberant", "cuddly", "excellent", "whimsical",
		"male", "three", "ambitious", "juvenile", "light", "pathetic", "quick", "freezing",
		"unbiased", "powerful", "dazzling", "vast", "needless", "brave", "abrupt", "ubiquitous",
		"nonchalant", "quack", "handsomely", "possessive", "deafening", "parallel", "frightened",
		"giant", "tenuous", "plain", "quiet", "true", "vacuous", "electric", "icy", "abhorrent",
		"abject", "addicted", "known", "shiny", "nimble", "polite", "fast", "lying", "erratic",
		"cut", "entertaining", "forgetful", "eight", "delicate", "nutritious", "tangible", "heavenly",
		"milky", "dear", "helpless", "rebel", "icky", "innate", "equal", "alleged", "panicky",
		"threatening", "irritating", "courageous", "tasteless", "drab", "thoughtful", "straight",
		"silent", "homeless", "humorous", "direful", "aboriginal", "thankful", "didactic", "damaged",
		"jobless", "guttural", "special", "pricey", "cruel", "colorful", "right", "orange", "holistic",
		"keen", "fretful", "squeamish",
	}
	words = []string{
		"apple", "bicycle", "cloud", "dragon", "elephant", "forest", "guitar", "hammer", "island", "jacket",
		"kitten", "lamp", "mountain", "notebook", "ocean", "pencil", "quilt", "river", "star", "table",
		"umbrella", "vase", "window", "xylophone", "yacht", "zebra", "balloon", "cactus", "dolphin", "envelope",
		"feather", "glacier", "honey", "igloo", "jungle", "key", "lizard", "magnet", "nest", "owl",
		"piano", "quartz", "rocket", "sandwich", "tiger", "unicorn", "volcano", "whale", "yogurt", "zipper",
		"bridge", "candle", "desert", "eagle", "fountain", "giraffe", "hat", "insect", "jewel", "kangaroo",
		"leaf", "mirror", "noodle", "orchid", "pebble", "queen", "rose", "ship", "telescope", "utensil",
		"village", "waterfall", "xenon", "year", "zucchini", "arrow", "bear", "cake", "diamond", "egg",
		"fire", "goose", "house", "ink", "juice", "knife", "moon", "needle", "olive", "paint",
		"ring", "stone", "thread", "violin", "wheel", "camera", "music", "movie", "game", "ball", "park",
	}
)

// The standard implementation of generating a human readable session id.
// For now, it is a combination of a 2 adjectives and a 2 nouns combined
// with a dash.
//
// The possible number of session ids is 101 * 101 * 101 * 101 = 1.030.301
func GetSessionId() string {
	log.Println(len(words))
	log.Println(len(adjectives))
	adjId, _ := rand.Int(rand.Reader, big.NewInt(101))
	nounId, _ := rand.Int(rand.Reader, big.NewInt(101))

	adj := adjectives[adjId.Int64()]
	noun := words[nounId.Int64()]
	return adj + "-" + noun
}

// Hashes a session id which should be used when saving or fetching session
// data from the cache.
func HashSessionId(sessionId string) string {
	h := sha256.New()
	h.Write([]byte(sessionId))
	return hex.EncodeToString(h.Sum(nil))
}
