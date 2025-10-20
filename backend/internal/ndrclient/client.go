package ndrclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"time"
)

// Client defines the contract for interacting with the upstream NDR service.
type Client interface {
	Ping(ctx context.Context) error
	CreateNode(ctx context.Context, meta RequestMeta, body NodeCreate) (Node, error)
	GetNode(ctx context.Context, meta RequestMeta, id int64, opts GetNodeOptions) (Node, error)
	UpdateNode(ctx context.Context, meta RequestMeta, id int64, body NodeUpdate) (Node, error)
	DeleteNode(ctx context.Context, meta RequestMeta, id int64) error
	RestoreNode(ctx context.Context, meta RequestMeta, id int64) (Node, error)
	ListNodes(ctx context.Context, meta RequestMeta, params ListNodesParams) (NodesPage, error)
	ListChildren(ctx context.Context, meta RequestMeta, id int64, params ListChildrenParams) ([]Node, error)
	ReorderNodes(ctx context.Context, meta RequestMeta, payload NodeReorderPayload) ([]Node, error)
	PurgeNode(ctx context.Context, meta RequestMeta, id int64) error
}

// NDRConfig describes the minimal configuration required by the client.
type NDRConfig struct {
	BaseURL string
	APIKey  string
}

// RequestMeta contains per-request metadata forwarded to NDR.
type RequestMeta struct {
	APIKey    string
	UserID    string
	RequestID string
}

type httpClient struct {
	baseURL    *url.URL
	apiKey     string
	httpClient *http.Client
}

// NewClient returns an HTTP backed NDR client.
func NewClient(cfg NDRConfig) Client {
	var parsed *url.URL
	if cfg.BaseURL != "" {
		parsed, _ = url.Parse(cfg.BaseURL)
	}
	return &httpClient{
		baseURL:    parsed,
		apiKey:     cfg.APIKey,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *httpClient) Ping(ctx context.Context) error {
	req, err := c.newRequest(ctx, http.MethodGet, "/ready", RequestMeta{}, nil)
	if err != nil {
		return err
	}
	_, err = c.do(req, nil)
	return err
}

func (c *httpClient) CreateNode(ctx context.Context, meta RequestMeta, body NodeCreate) (Node, error) {
	req, err := c.newRequest(ctx, http.MethodPost, "/api/v1/nodes", meta, body)
	if err != nil {
		return Node{}, err
	}
	var resp Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) GetNode(ctx context.Context, meta RequestMeta, id int64, opts GetNodeOptions) (Node, error) {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d", id)
	query := url.Values{}
	if opts.IncludeDeleted != nil {
		query.Set("include_deleted", fmt.Sprintf("%t", *opts.IncludeDeleted))
	}
	req, err := c.newRequestWithQuery(ctx, http.MethodGet, endpoint, meta, nil, query)
	if err != nil {
		return Node{}, err
	}
	var resp Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) UpdateNode(ctx context.Context, meta RequestMeta, id int64, body NodeUpdate) (Node, error) {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d", id)
	req, err := c.newRequest(ctx, http.MethodPut, endpoint, meta, body)
	if err != nil {
		return Node{}, err
	}
	var resp Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) DeleteNode(ctx context.Context, meta RequestMeta, id int64) error {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d", id)
	req, err := c.newRequest(ctx, http.MethodDelete, endpoint, meta, nil)
	if err != nil {
		return err
	}
	_, err = c.do(req, nil)
	return err
}

func (c *httpClient) RestoreNode(ctx context.Context, meta RequestMeta, id int64) (Node, error) {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d/restore", id)
	req, err := c.newRequest(ctx, http.MethodPost, endpoint, meta, nil)
	if err != nil {
		return Node{}, err
	}
	var resp Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) ListNodes(ctx context.Context, meta RequestMeta, params ListNodesParams) (NodesPage, error) {
	query := url.Values{}
	if params.Page > 0 {
		query.Set("page", fmt.Sprintf("%d", params.Page))
	}
	if params.Size > 0 {
		query.Set("size", fmt.Sprintf("%d", params.Size))
	}
	if params.IncludeDeleted != nil {
		query.Set("include_deleted", fmt.Sprintf("%t", *params.IncludeDeleted))
	}
	req, err := c.newRequestWithQuery(ctx, http.MethodGet, "/api/v1/nodes", meta, nil, query)
	if err != nil {
		return NodesPage{}, err
	}
	var resp NodesPage
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) ListChildren(ctx context.Context, meta RequestMeta, id int64, params ListChildrenParams) ([]Node, error) {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d/children", id)
	query := url.Values{}
	if params.Depth > 0 {
		query.Set("depth", fmt.Sprintf("%d", params.Depth))
	}
	req, err := c.newRequestWithQuery(ctx, http.MethodGet, endpoint, meta, nil, query)
	if err != nil {
		return nil, err
	}
	var resp []Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) ReorderNodes(ctx context.Context, meta RequestMeta, payload NodeReorderPayload) ([]Node, error) {
	req, err := c.newRequest(ctx, http.MethodPost, "/api/v1/nodes/reorder", meta, payload)
	if err != nil {
		return nil, err
	}
	var resp []Node
	_, err = c.do(req, &resp)
	return resp, err
}

func (c *httpClient) PurgeNode(ctx context.Context, meta RequestMeta, id int64) error {
	endpoint := fmt.Sprintf("/api/v1/nodes/%d/purge", id)
	req, err := c.newRequest(ctx, http.MethodDelete, endpoint, meta, nil)
	if err != nil {
		return err
	}
	_, err = c.do(req, nil)
	return err
}

func (c *httpClient) newRequest(ctx context.Context, method, endpoint string, meta RequestMeta, body any) (*http.Request, error) {
	return c.newRequestWithQuery(ctx, method, endpoint, meta, body, nil)
}

func (c *httpClient) newRequestWithQuery(ctx context.Context, method, endpoint string, meta RequestMeta, body any, query url.Values) (*http.Request, error) {
	if c.baseURL == nil {
		return nil, fmt.Errorf("ndr base url is not configured")
	}
	var payload io.Reader
	if body != nil {
		buf := bytes.NewBuffer(nil)
		if err := json.NewEncoder(buf).Encode(body); err != nil {
			return nil, err
		}
		payload = buf
	}
	fullURL := *c.baseURL
	fullURL.Path = path.Join(c.baseURL.Path, endpoint)
	if query != nil {
		fullURL.RawQuery = query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, fullURL.String(), payload)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	apiKey := meta.APIKey
	if apiKey == "" {
		apiKey = c.apiKey
	}
	if apiKey != "" {
		req.Header.Set("x-api-key", apiKey)
	}
	if meta.UserID != "" {
		req.Header.Set("x-user-id", meta.UserID)
	}
	if meta.RequestID != "" {
		req.Header.Set("x-request-id", meta.RequestID)
	}
	return req, nil
}

func (c *httpClient) do(req *http.Request, out any) (*http.Response, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()
	if resp.StatusCode >= 400 {
		return resp, fmt.Errorf("ndr request failed: %s", resp.Status)
	}
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return resp, err
		}
	}
	return resp, nil
}
