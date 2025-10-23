package authz

import (
	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"gorm.io/gorm"
)

// NewEnforcer initializes a Casbin enforcer with domain-aware RBAC model.
// If a gorm.DB is provided, policies are persisted via gorm-adapter; otherwise in-memory is used.
func NewEnforcer(db *gorm.DB) (*casbin.Enforcer, error) {
	m := model.NewModel()
	m.AddDef("r", "r", "sub, dom, obj, act")
	m.AddDef("p", "p", "sub, dom, obj, act")
	m.AddDef("g", "g", "_, _, _") // domain-aware RBAC: g, user, role, domain
	m.AddDef("e", "e", "some(where (p.eft == allow))")
	m.AddDef("m", "m", "g(r.sub, p.sub, r.dom) && (r.dom == p.dom || p.dom == \"*\") && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act)")

	var (
		e   *casbin.Enforcer
		err error
	)

	if db != nil {
		// Persist policies to DB using gorm-adapter, table name `casbin_rule`.
		a, err := gormadapter.NewAdapterByDBUseTableName(db, "", "casbin_rule")
		if err != nil {
			return nil, err
		}
		e, err = casbin.NewEnforcer(m, a)
		if err != nil {
			return nil, err
		}
		if err := e.LoadPolicy(); err != nil {
			return nil, err
		}
	} else {
		// Fallback to in-memory enforcer.
		e, err = casbin.NewEnforcer(m)
		if err != nil {
			return nil, err
		}
	}

	// Ensure default wildcard policy for super_admin role: all domains, any object, any action.
	_, _ = e.AddPolicy("super_admin", "*", "*", ".*")

	return e, nil
}

// AssignCourseAdmin grants course_admin within a specific domain (root node id).
func AssignCourseAdmin(e *casbin.Enforcer, user string, domain string) (bool, error) {
	return e.AddGroupingPolicy(user, "course_admin", domain)
}

// AssignProofreader grants proofreader within a specific domain (root node id).
func AssignProofreader(e *casbin.Enforcer, user string, domain string) (bool, error) {
	return e.AddGroupingPolicy(user, "proofreader", domain)
}