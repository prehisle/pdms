package service

import "fmt"

// DocumentType defines the type of document content
type DocumentType string

const (
	// DocTypeOverview represents an HTML overview document
	DocTypeOverview DocumentType = "overview"
	// DocTypeDictation represents a dictation exercise in YAML format
	DocTypeDictation DocumentType = "dictation"
	// DocTypeComprehensiveChoice represents a multi-blank choice question in YAML format
	// Each blank corresponds to a single-choice sub-question
	DocTypeComprehensiveChoice DocumentType = "comprehensive_choice"
	// DocTypeCaseAnalysis represents a case analysis question in YAML format
	DocTypeCaseAnalysis DocumentType = "case_analysis"
	// DocTypeEssay represents an essay question in YAML format
	DocTypeEssay DocumentType = "essay"
)

// ContentFormat defines the storage format of document content
type ContentFormat string

const (
	ContentFormatHTML ContentFormat = "html"
	ContentFormatYAML ContentFormat = "yaml"
)

// DocumentContent represents the structured content of a document
type DocumentContent struct {
	Format ContentFormat `json:"format"`
	Data   string        `json:"data"`
}

// ValidDocumentTypes returns all valid document types
func ValidDocumentTypes() []DocumentType {
	return []DocumentType{
		DocTypeOverview,
		DocTypeDictation,
		DocTypeComprehensiveChoice,
		DocTypeCaseAnalysis,
		DocTypeEssay,
	}
}

// IsValidDocumentType checks if a document type is valid
func IsValidDocumentType(t string) bool {
	for _, validType := range ValidDocumentTypes() {
		if string(validType) == t {
			return true
		}
	}
	return false
}

// GetContentFormat returns the expected content format for a document type
func GetContentFormat(docType DocumentType) ContentFormat {
	switch docType {
	case DocTypeOverview:
		return ContentFormatHTML
	case DocTypeDictation, DocTypeComprehensiveChoice, DocTypeCaseAnalysis, DocTypeEssay:
		return ContentFormatYAML
	default:
		return ContentFormatYAML
	}
}

// ValidateDocumentContent validates the document content structure
func ValidateDocumentContent(content map[string]any, docType string) error {
	if !IsValidDocumentType(docType) {
		return fmt.Errorf("invalid document type: %s", docType)
	}

	if content == nil {
		return nil // Empty content is allowed
	}

	// Check format field
	formatVal, hasFormat := content["format"]
	if !hasFormat {
		return fmt.Errorf("content must have 'format' field")
	}

	format, ok := formatVal.(string)
	if !ok {
		return fmt.Errorf("content.format must be a string")
	}

	expectedFormat := GetContentFormat(DocumentType(docType))
	if format != string(expectedFormat) {
		return fmt.Errorf("content format '%s' does not match expected format '%s' for type '%s'",
			format, expectedFormat, docType)
	}

	// Check data field
	dataVal, hasData := content["data"]
	if !hasData {
		return fmt.Errorf("content must have 'data' field")
	}

	if _, ok := dataVal.(string); !ok {
		return fmt.Errorf("content.data must be a string")
	}

	return nil
}

// ValidateDocumentMetadata validates common metadata fields
func ValidateDocumentMetadata(metadata map[string]any) error {
	if metadata == nil {
		return nil
	}

	// Validate difficulty if present
	if diffVal, hasDiff := metadata["difficulty"]; hasDiff {
		switch v := diffVal.(type) {
		case float64:
			if v < 1 || v > 5 {
				return fmt.Errorf("difficulty must be between 1 and 5")
			}
		case int:
			if v < 1 || v > 5 {
				return fmt.Errorf("difficulty must be between 1 and 5")
			}
		default:
			return fmt.Errorf("difficulty must be a number")
		}
	}

	// Validate tags if present
	if tagsVal, hasTags := metadata["tags"]; hasTags {
		if _, ok := tagsVal.([]interface{}); !ok {
			return fmt.Errorf("tags must be an array")
		}
	}

	return nil
}
