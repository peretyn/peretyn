package fga

import "testing"

func TestConcurrentReadCapsStayBelowThePool(t *testing.T) {
	for name, cap := range map[string]int{
		"check": maxConcurrentReadsForCheck,
		"list":  maxConcurrentReadsForList,
	} {
		if cap <= 0 {
			t.Errorf("%s cap is %d, which disables reads entirely", name, cap)
		}
		if cap >= maxOpenConns {
			t.Errorf("%s cap is %d against a pool of %d, so one request can still take the pool", name, cap, maxOpenConns)
		}
	}
}

func TestListReadsAreCappedTighterThanCheck(t *testing.T) {
	if maxConcurrentReadsForList >= maxConcurrentReadsForCheck {
		t.Errorf("list cap %d is not tighter than check cap %d, despite list being the expensive path",
			maxConcurrentReadsForList, maxConcurrentReadsForCheck)
	}
}
