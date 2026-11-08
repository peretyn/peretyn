# Peretyn

Peretyn is a relationship-based authorization platform. Developers model who can do what, and their applications ask Peretyn for decisions.

## Language

### People

**Developer**:
A person who builds an application on Peretyn, either against the managed service or against their own self-hosted stack. The audience of the docs.
_Avoid_: user, customer, client

**Self-Hoster**:
A Developer who runs the Peretyn server stack on their own infrastructure instead of using the managed service.
_Avoid_: operator, on-prem user

### Workspace

**Organization**:
A team that owns Projects and the people who can manage them.
_Avoid_: account, workspace, tenant

**Project**:
One application's authorization setup, made of Environments.
_Avoid_: app, service

**Environment**:
An isolated copy of a Project's authorization data, with its own Model, Tuples and API key. Every Project has `production` and `development`.
_Avoid_: stage, store

**API key**:
The secret that identifies one Environment to the SDK and the CLI. Production keys start with `prn_live_`, the others with `prn_test_`.
_Avoid_: token, environment key, env key, secret

### Modeling

**Schema**:
The TypeScript declaration of types, Relations and Permissions that a Developer writes.
_Avoid_: model (for the source), policy

**Model**:
A Schema compiled into the form the runtime evaluates, and published to an Environment.
_Avoid_: artifact, authorization model

**Subject**:
Who or what a Tuple or Check is about, such as `user:alice` or `team:core#member`.
_Avoid_: user, principal, actor

**Object**:
The thing a Subject is related to, such as `document:roadmap`.
_Avoid_: resource, entity

**Relation**:
A direct link between a Subject and an Object, declared in the Schema and stored as Tuples.
_Avoid_: role, relationship

**Permission**:
A rule computed from Relations. It is only checked, never written.
_Avoid_: computed relation, policy, rule

**Tuple**:
One stored fact: a Subject has a Relation on an Object.
_Avoid_: relationship, grant, edge

### Decisions

**Check**:
The question whether a Subject has a Relation or Permission on an Object.
_Avoid_: authorize, evaluate, query

**Verdict**:
The answer to a check: either allowed or denied.
_Avoid_: result, decision, outcome
