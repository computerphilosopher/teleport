// Copyright 2023 Gravitational, Inc
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package db

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/gravitational/teleport/api/types"
)

/*
$ go test ./lib/srv/db -bench=. -run=^$ -benchtime=3x
goos: darwin
goarch: arm64
pkg: github.com/gravitational/teleport/lib/srv/db
BenchmarkPostgresReadLargeTable/size=11-10         	       3	 286618514 ns/op
BenchmarkPostgresReadLargeTable/size=20-10         	       3	 253457917 ns/op
BenchmarkPostgresReadLargeTable/size=100-10        	       3	 222804292 ns/op
BenchmarkPostgresReadLargeTable/size=1000-10       	       3	 216612764 ns/op
BenchmarkPostgresReadLargeTable/size=2000-10       	       3	 214121861 ns/op
BenchmarkPostgresReadLargeTable/size=8000-10       	       3	 215046472 ns/op
*/
// BenchmarkPostgresReadLargeTable is a benchmark for read-heavy usage of Postgres.
// Depending on the message size we may get different performance, due to the way the respective engine is written.
func BenchmarkPostgresReadLargeTable(b *testing.B) {
	b.StopTimer()
	ctx := context.Background()
	testCtx := setupTestContext(ctx, b, withSelfHostedPostgres("postgres", func(db *types.DatabaseV3) {
		db.SetStaticLabels(map[string]string{"foo": "bar"})
	}))
	go testCtx.startHandlingConnections()

	user := "alice"
	role := "admin"
	allow := []string{types.Wildcard}

	// Create user/role with the requested permissions.
	testCtx.createUserAndRole(ctx, b, user, role, allow, allow)
	for _, messageSize := range []int{11, 20, 100, 1000, 2000, 8000} {

		// connect to the database
		pgConn, err := testCtx.postgresClient(ctx, user, "postgres", "postgres", "postgres")
		require.NoError(b, err)

		// total bytes to be transmitted, approximate.
		const totalBytes = 100 * 1024 * 1024
		// calculate the number of messages required to reach totalBytes of transferred data.
		rowCount := totalBytes / messageSize

		// run first query without timer. the server will cache the message.
		_, err = pgConn.Exec(ctx, fmt.Sprintf("SELECT * FROM bench_%v LIMIT %v", messageSize, rowCount)).ReadAll()
		require.NoError(b, err)

		b.Run(fmt.Sprintf("size=%v", messageSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Execute a query, count results.
				q := pgConn.Exec(ctx, fmt.Sprintf("SELECT * FROM bench_%v LIMIT %v", messageSize, rowCount))

				// pgConn.Exec can potentially execute multiple SQL queries.
				// the outer loop is a query loop, the inner loop is for individual results.
				rows := 0
				for q.NextResult() {
					rr := q.ResultReader()
					for rr.NextRow() {
						rows++
					}
				}

				require.NoError(b, q.Close())
				require.Equal(b, rowCount, rows)
			}
		})

		// Disconnect.
		err = pgConn.Close(ctx)
		require.NoError(b, err)
	}
}
