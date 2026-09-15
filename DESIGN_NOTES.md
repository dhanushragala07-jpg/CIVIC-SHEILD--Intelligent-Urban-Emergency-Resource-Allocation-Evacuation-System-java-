# CIVIC-SHIELD Design Notes

## Main classes
- `Emergency` (abstract)
- `FloodEmergency`
- `FireEmergency`
- `MedicalEmergency`
- `HeatEmergency`
- `Resource`
- `Shelter`
- `Road`
- `SmartPriorityCalculator`
- `DijkstraRoutePlanner`
- `CivicShieldApp`

## Core algorithm: Priority score
Priority is based on:
- affected population
- vulnerable population
- medical urgency
- risk level
- emergency-specific multiplier

The score is capped at 100.

## Core algorithm: Dijkstra
The road network is represented as an adjacency list. Blocked roads are ignored. Dijkstra's algorithm selects the lowest total travel-time path to the destination shelter.

## What-if simulations
1. Risk escalation
2. Ambulance shortage
3. Shelter capacity reduction

The point of the simulation is not to predict a real disaster. It demonstrates how a decision-support system can respond to changing inputs.

## Important limitation
This is an academic prototype. It does not use live emergency-service data, real GPS traffic, official disaster models, or real-time public safety infrastructure.
