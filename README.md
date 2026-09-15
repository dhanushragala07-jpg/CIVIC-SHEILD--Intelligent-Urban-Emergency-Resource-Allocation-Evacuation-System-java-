# CIVIC-SHIELD
## Urban Emergency Decision Support & Evacuation System

### Academic context
- Course: BACSE102 / Problem Solving using Java
- Activity: 2
- Semester: Fall 2026-2027
- Faculty: Dr.Vivek.D
- SDG focus: SDG 11 – Sustainable Cities and Communities
- Supporting SDGs: SDG 3 and SDG 13

### What makes the project different
CIVIC-SHIELD is a decision-support prototype rather than a basic CRUD management system. It:
1. Scores emergencies using population, vulnerability, medical urgency, risk and incident type.
2. Uses a PriorityQueue to process the most urgent incident first.
3. Allocates scarce emergency resources according to priority.
4. Finds a safe shortest evacuation path using Dijkstra's algorithm.
5. Runs what-if simulations for changing risk, resource shortages and shelter capacity.
6. Uses multithreading to simulate multiple incidents being processed concurrently.
7. Persists emergency reports to a CSV file.

### Run the Java program
Requirements: Java 17 or newer.

```bash
javac CIVICShield.java
java CIVICShield
```

The program creates `civicshield_emergencies.csv` in the same folder after an emergency is saved.

### Suggested demonstration sequence
1. Report 4 emergencies:
   - E101, FLOOD, E, 1250 people, 320 vulnerable, medical 8, risk 9
   - E102, FIRE, B, 180 people, 40 vulnerable, medical 9, risk 10
   - E103, MEDICAL, C, 50 people, 25 vulnerable, medical 10, risk 8
   - E104, HEAT, G, 900 people, 300 vulnerable, medical 7, risk 7
2. View the priority queue.
3. Run resource allocation.
4. Find route E -> S3.
5. Run What-If scenario 1.
6. Run multi-incident simulation.
7. Generate impact report.

### Important academic note
The website in this package is a front-end demonstration of the same decision model. The Java program is the assessed implementation.

### Open the website
For the simplest option, double-click `website/index.html`.
For a local server, open Command Prompt inside the `website` folder and run:
`python -m http.server 8000`
Then open `http://localhost:8000`.

### Execution screenshot
`docs/CIVIC_SHIELD_Java_Execution_Screenshot.png` is an actual successful run of the supplied Java program and can be pasted into Section 12 of the Activity-2 sheet. Replace the blank student name/register fields before submission.
