package utils

import (
	"crypto/rand"
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
		"keen", "fretful",
	}
	words = []string{
		"proposal", "ear", "phone", "competition", "reaction", "professor", "assumption", "actor",
		"soup", "newspaper", "resolution", "university", "application", "storage", "session", "girlfriend",
		"woman", "child", "administration", "role", "transportation", "assistance", "wedding", "ratio",
		"hair", "association", "worker", "estate", "sympathy", "driver", "news", "oven", "cookie",
		"inspector", "wealth", "response", "potato", "definition", "efficiency", "policy", "information",
		"police", "dealer", "advertising", "leadership", "examination", "idea", "understanding", "statement",
		"relation", "departure", "relationship", "replacement", "bird", "thought", "virus", "law", "tale",
		"science", "committee", "personality", "growth", "bathroom", "confusion", "possibility", "disk",
		"variation", "combination", "power", "manufacturer", "photo", "unit", "passenger", "knowledge",
		"failure", "medicine", "dinner", "youth", "river", "king", "marriage", "mom", "diamond", "thing",
		"secretary", "computer", "coffee", "explanation", "system", "message", "history", "moment",
	}
)

func GetSessionId() string {
	adjId, _ := rand.Int(rand.Reader, big.NewInt(101))
	nounId, _ := rand.Int(rand.Reader, big.NewInt(101))

	adj := adjectives[adjId.Int64()]
	noun := words[nounId.Int64()]
	return adj + "-" + noun
}
