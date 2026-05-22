package main

import (
	"fmt"
	"log"
	"os"

	"github.com/JoakimCarlsson/bastion/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	switch os.Args[1] {
	case "up":
		if err := store.RunUp(databaseURL); err != nil {
			log.Fatal(err)
		}
	case "down":
		if err := store.RunDown(databaseURL); err != nil {
			log.Fatal(err)
		}
	case "version":
		v, err := store.Version(databaseURL)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("version: %d dirty: %t\n", v.Version, v.Dirty)
	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, "usage: %s <up|down|version>\n", os.Args[0])
}
