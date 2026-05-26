// Package session constants.
//
// Source of truth: web/src/game/constants.ts and web/src/game/maps/starter.ts.
// When the JS source changes, update this file to match.
package session

// TowerDef describes a tower type available for placement.
type TowerDef struct {
	ID       string
	Name     string
	Cost     int
	Damage   int
	Range    float64
	FireRate float64
}

// EnemyDef describes an enemy archetype.
type EnemyDef struct {
	ID     string
	Name   string
	HP     int
	Speed  float64
	Reward int
}

// WaveDef is one wave's spawn configuration.
type WaveDef struct {
	Enemies []SpawnGroup
}

// SpawnGroup is one enemy group inside a WaveDef.
type SpawnGroup struct {
	DefID    string
	Count    int
	Interval float64
}

// TowerDefs mirrors TOWER_DEFS from web/src/game/constants.ts.
var TowerDefs = map[string]TowerDef{
	"cannon": {
		ID:       "cannon",
		Name:     "Cannon",
		Cost:     50,
		Damage:   20,
		Range:    3,
		FireRate: 0.5,
	},
	"archer": {
		ID:       "archer",
		Name:     "Archer",
		Cost:     25,
		Damage:   8,
		Range:    5,
		FireRate: 1.5,
	},
}

// EnemyDefs mirrors ENEMY_DEFS from web/src/game/constants.ts.
var EnemyDefs = map[string]EnemyDef{
	"goblin": {
		ID:     "goblin",
		Name:   "Goblin",
		HP:     30,
		Speed:  2,
		Reward: 10,
	},
}

// Waves mirrors WAVES from web/src/game/sim/waves.ts (goblin counts: 5 / 8 / 12).
var Waves = []WaveDef{
	{Enemies: []SpawnGroup{{DefID: "goblin", Count: 5, Interval: 1.5}}},
	{Enemies: []SpawnGroup{{DefID: "goblin", Count: 8, Interval: 1.2}}},
	{Enemies: []SpawnGroup{{DefID: "goblin", Count: 12, Interval: 1.0}}},
}

// --- Starter map (mirrors web/src/game/maps/starter.ts) ---

const starterMapCols = 20
const starterMapRows = 15

// starterPathWaypoints is the path for the starter map.
var starterPathWaypoints = [][2]int{
	{0, 7},
	{4, 7},
	{4, 3},
	{10, 3},
	{10, 11},
	{16, 11},
	{16, 7},
	{19, 7},
}

// Cell represents one grid cell.
type Cell struct {
	X         int
	Y         int
	Buildable bool
}

// starterBuildableCells is the set of buildable cell coordinates, computed
// once at init from the path waypoints (matches the JS buildGrid() function).
var starterBuildableCells map[[2]int]bool

func init() {
	pathCells := make(map[[2]int]bool)
	wps := starterPathWaypoints
	for w := 0; w < len(wps)-1; w++ {
		from := wps[w]
		to := wps[w+1]
		if from[0] == to[0] { // vertical segment
			minY, maxY := from[1], to[1]
			if minY > maxY {
				minY, maxY = maxY, minY
			}
			for y := minY; y <= maxY; y++ {
				pathCells[[2]int{from[0], y}] = true
			}
		} else { // horizontal segment
			minX, maxX := from[0], to[0]
			if minX > maxX {
				minX, maxX = maxX, minX
			}
			for x := minX; x <= maxX; x++ {
				pathCells[[2]int{x, from[1]}] = true
			}
		}
	}

	starterBuildableCells = make(map[[2]int]bool)
	dirs := [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
	for c := range pathCells {
		for _, d := range dirs {
			n := [2]int{c[0] + d[0], c[1] + d[1]}
			if n[0] >= 0 && n[0] < starterMapCols && n[1] >= 0 &&
				n[1] < starterMapRows &&
				!pathCells[n] {
				starterBuildableCells[n] = true
			}
		}
	}
}

// IsBuildable reports whether cell (x, y) is a buildable cell on the starter map.
func IsBuildable(x, y int) bool {
	return starterBuildableCells[[2]int{x, y}]
}
