module github.com/JoakimCarlsson/bastion

go 1.25

require (
	github.com/golang-migrate/migrate/v4 v4.18.2
	github.com/jackc/pgx/v5 v5.7.4
	github.com/joakimcarlsson/minmux/cors v0.0.0-00010101000000-000000000000
	github.com/joakimcarlsson/minmux/router v0.0.0-00010101000000-000000000000
)

require (
	github.com/coder/websocket v1.8.13 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/lib/pq v1.10.9 // indirect
	go.uber.org/atomic v1.7.0 // indirect
	golang.org/x/crypto v0.31.0 // indirect
	golang.org/x/sync v0.10.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)

replace github.com/joakimcarlsson/minmux/cors => ./deps/minmux/cors

replace github.com/joakimcarlsson/minmux/router => ./deps/minmux/router
