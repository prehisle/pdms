package ndrclient

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"testing"
	"time"
)

func TestClientNodeOperations(t *testing.T) {
	testTime := time.Date(2024, 10, 1, 12, 0, 0, 0, time.UTC)
	type recordedCall struct {
		Method  string
		Path    string
		Headers http.Header
		Body    []byte
	}
	var calls []recordedCall

	node := Node{
		ID:        1,
		Name:      "Root",
		Slug:      "root",
		Path:      "/root",
		ParentID:  nil,
		Position:  1,
		CreatedBy: "tester",
		UpdatedBy: "tester",
		CreatedAt: testTime,
		UpdatedAt: testTime,
	}
	child := Node{
		ID:        2,
		Name:      "Child",
		Slug:      "child",
		Path:      "/root/child",
		ParentID:  ptr[int64](1),
		Position:  2,
		CreatedBy: "tester",
		UpdatedBy: "tester",
		CreatedAt: testTime,
		UpdatedAt: testTime,
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := bytes.Buffer{}
		_, _ = body.ReadFrom(r.Body)
		calls = append(calls, recordedCall{
			Method:  r.Method,
			Path:    r.URL.Path,
			Headers: r.Header.Clone(),
			Body:    body.Bytes(),
		})

		writeJSON := func(status int, v any) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			if v != nil {
				_ = json.NewEncoder(w).Encode(v)
			}
		}

		switch {
		case r.URL.Path == "/ready":
			writeJSON(http.StatusOK, map[string]string{"status": "ok"})
		case r.URL.Path == "/api/v1/nodes" && r.Method == http.MethodPost:
			writeJSON(http.StatusCreated, node)
		case r.URL.Path == "/api/v1/nodes" && r.Method == http.MethodGet:
			writeJSON(http.StatusOK, NodesPage{
				Page:  1,
				Size:  2,
				Total: 2,
				Items: []Node{node, child},
			})
		case r.URL.Path == path.Join("/api/v1/nodes", "1") && r.Method == http.MethodGet:
			writeJSON(http.StatusOK, node)
		case r.URL.Path == path.Join("/api/v1/nodes", "1") && r.Method == http.MethodPut:
			writeJSON(http.StatusOK, node)
		case r.URL.Path == path.Join("/api/v1/nodes", "1") && r.Method == http.MethodDelete:
			writeJSON(http.StatusNoContent, nil)
		case r.URL.Path == path.Join("/api/v1/nodes", "1", "restore"):
			writeJSON(http.StatusOK, node)
		case r.URL.Path == path.Join("/api/v1/nodes", "reorder"):
			writeJSON(http.StatusOK, []Node{node, child})
		default:
			http.NotFound(w, r)
		}
	})

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client := NewClient(NDRConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	ctx := context.Background()
	meta := RequestMeta{
		UserID:    "tester",
		RequestID: "req-id",
	}

	if err := client.Ping(ctx); err != nil {
		t.Fatalf("Ping failed: %v", err)
	}

	if _, err := client.CreateNode(ctx, meta, NodeCreate{Name: "Root"}); err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}

	if _, err := client.ListNodes(ctx, meta, ListNodesParams{}); err != nil {
		t.Fatalf("ListNodes failed: %v", err)
	}

	if _, err := client.GetNode(ctx, meta, 1, GetNodeOptions{}); err != nil {
		t.Fatalf("GetNode failed: %v", err)
	}

	if _, err := client.UpdateNode(ctx, meta, 1, NodeUpdate{Name: ptr("Root")}); err != nil {
		t.Fatalf("UpdateNode failed: %v", err)
	}

	if err := client.DeleteNode(ctx, meta, 1); err != nil {
		t.Fatalf("DeleteNode failed: %v", err)
	}

	if _, err := client.RestoreNode(ctx, meta, 1); err != nil {
		t.Fatalf("RestoreNode failed: %v", err)
	}

	if _, err := client.ReorderNodes(ctx, meta, NodeReorderPayload{
		ParentID:   ptr[int64](1),
		OrderedIDs: []int64{2, 1},
	}); err != nil {
		t.Fatalf("ReorderNodes failed: %v", err)
	}

	if len(calls) == 0 {
		t.Fatalf("expected recorded calls")
	}

	last := calls[len(calls)-1]
	if got := last.Headers.Get("x-api-key"); got != "test-key" {
		t.Fatalf("expected x-api-key header to fallback to config, got %q", got)
	}
	if got := last.Headers.Get("x-user-id"); got != meta.UserID {
		t.Fatalf("expected x-user-id header, got %q", got)
	}
	if got := last.Headers.Get("x-request-id"); got != meta.RequestID {
		t.Fatalf("expected x-request-id header, got %q", got)
	}
}

func ptr[T any](v T) *T {
	return &v
}

var (
	realNDRURL   = flag.String("ndr.url", "", "real NDR base url for integration test")
	realNDRAPI   = flag.String("ndr.apikey", "", "real NDR API key")
	realNDRUser  = flag.String("ndr.user", "test-user", "real NDR user id header")
	realNDRReqID = flag.String("ndr.reqid", "ndr-client-integration", "request id header")
)

func TestRealNDRIntegration(t *testing.T) {
	if strings.TrimSpace(*realNDRURL) == "" {
		t.Skip("real NDR URL not provided; skipping integration test")
	}

	client := NewClient(NDRConfig{
		BaseURL: strings.TrimSpace(*realNDRURL),
		APIKey:  strings.TrimSpace(*realNDRAPI),
	})

	ctx := context.Background()
	meta := RequestMeta{
		APIKey:    strings.TrimSpace(*realNDRAPI),
		UserID:    strings.TrimSpace(*realNDRUser),
		RequestID: fmt.Sprintf("%s-%d", strings.TrimSpace(*realNDRReqID), time.Now().UnixNano()),
	}

	name := fmt.Sprintf("auto-test-%d", time.Now().UnixNano())
	slug := name

	created, err := client.CreateNode(ctx, meta, NodeCreate{
		Name:       name,
		Slug:       &slug,
		ParentPath: nil,
	})
	if err != nil {
		t.Fatalf("CreateNode failed: %v", err)
	}
	t.Cleanup(func() {
		_ = client.DeleteNode(ctx, meta, created.ID)
	})

	fetched, err := client.GetNode(ctx, meta, created.ID, GetNodeOptions{})
	if err != nil {
		t.Fatalf("GetNode failed: %v", err)
	}
	if fetched.Name != name {
		t.Fatalf("expected node name %q, got %q", name, fetched.Name)
	}

	page, err := client.ListNodes(ctx, meta, ListNodesParams{Page: 1, Size: 50})
	if err != nil {
		t.Fatalf("ListNodes failed: %v", err)
	}
	found := false
	for _, n := range page.Items {
		if n.ID == created.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("created node id %d not found in ListNodes response", created.ID)
	}
}
