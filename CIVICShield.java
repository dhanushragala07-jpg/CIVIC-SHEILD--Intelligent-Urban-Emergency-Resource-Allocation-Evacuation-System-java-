import java.io.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

/**
 * CIVIC-SHIELD
 * Urban Emergency Decision Support & Evacuation System
 *
 * Single-file Java implementation for BACSE102 Activity-2.
 * Java 17+ recommended.
 */
public class CIVICShield {
    static final Scanner sc = new Scanner(System.in);
    static final String DATA_FILE = "civicshield_emergencies.csv";

    // ---------- Interfaces ----------
    interface PriorityCalculator {
        double calculate(Emergency e);
    }

    interface RoutePlanner {
        List<String> shortestRoute(String start, String destination, Map<String, List<Road>> graph);
    }

    // ---------- Abstraction + Encapsulation ----------
    static abstract class Emergency {
        private final String id;
        private final String zone;
        private final int peopleAffected;
        private final int vulnerablePeople;
        private final int medicalUrgency; // 1-10
        private int riskLevel;             // 1-10

        Emergency(String id, String zone, int peopleAffected, int vulnerablePeople,
                  int medicalUrgency, int riskLevel) {
            this.id = id;
            this.zone = zone;
            this.peopleAffected = peopleAffected;
            this.vulnerablePeople = vulnerablePeople;
            this.medicalUrgency = medicalUrgency;
            this.riskLevel = riskLevel;
        }

        public String getId() { return id; }
        public String getZone() { return zone; }
        public int getPeopleAffected() { return peopleAffected; }
        public int getVulnerablePeople() { return vulnerablePeople; }
        public int getMedicalUrgency() { return medicalUrgency; }
        public int getRiskLevel() { return riskLevel; }
        public void setRiskLevel(int riskLevel) { this.riskLevel = riskLevel; }

        public abstract String type();

        // Polymorphic emergency-specific multiplier.
        public abstract double typeMultiplier();

        public String toCsv() {
            return String.join(",", id, type(), zone, String.valueOf(peopleAffected),
                    String.valueOf(vulnerablePeople), String.valueOf(medicalUrgency),
                    String.valueOf(riskLevel));
        }
    }

    // ---------- Inheritance ----------
    static class FloodEmergency extends Emergency {
        FloodEmergency(String id, String zone, int people, int vulnerable, int medical, int risk) {
            super(id, zone, people, vulnerable, medical, risk);
        }
        public String type() { return "FLOOD"; }
        public double typeMultiplier() { return 1.12; }
    }

    static class FireEmergency extends Emergency {
        FireEmergency(String id, String zone, int people, int vulnerable, int medical, int risk) {
            super(id, zone, people, vulnerable, medical, risk);
        }
        public String type() { return "FIRE"; }
        public double typeMultiplier() { return 1.18; }
    }

    static class MedicalEmergency extends Emergency {
        MedicalEmergency(String id, String zone, int people, int vulnerable, int medical, int risk) {
            super(id, zone, people, vulnerable, medical, risk);
        }
        public String type() { return "MEDICAL"; }
        public double typeMultiplier() { return 1.20; }
    }

    static class HeatEmergency extends Emergency {
        HeatEmergency(String id, String zone, int people, int vulnerable, int medical, int risk) {
            super(id, zone, people, vulnerable, medical, risk);
        }
        public String type() { return "HEAT"; }
        public double typeMultiplier() { return 1.08; }
    }

    // ---------- Domain Objects ----------
    static class Resource {
        private final String id;
        private final String type;
        private int quantity;

        Resource(String id, String type, int quantity) {
            this.id = id;
            this.type = type;
            this.quantity = quantity;
        }

        public String getId() { return id; }
        public String getType() { return type; }
        public int getQuantity() { return quantity; }

        public boolean allocate(int amount) {
            if (amount <= 0 || amount > quantity) return false;
            quantity -= amount;
            return true;
        }

        public void add(int amount) {
            if (amount > 0) quantity += amount;
        }
    }

    static class Shelter {
        private final String id;
        private final String zone;
        private final int capacity;
        private int occupied;

        Shelter(String id, String zone, int capacity, int occupied) {
            this.id = id;
            this.zone = zone;
            this.capacity = capacity;
            this.occupied = occupied;
        }

        public String getId() { return id; }
        public String getZone() { return zone; }
        public int available() { return Math.max(0, capacity - occupied); }

        public boolean admit(int people) {
            if (people <= 0 || people > available()) return false;
            occupied += people;
            return true;
        }

        public String toString() {
            return id + " (" + zone + ") capacity=" + capacity +
                    ", occupied=" + occupied + ", available=" + available();
        }
    }

    static class Road {
        String to;
        int minutes;
        boolean blocked;

        Road(String to, int minutes, boolean blocked) {
            this.to = to;
            this.minutes = minutes;
            this.blocked = blocked;
        }
    }

    static class PathResult {
        List<String> path;
        int minutes;

        PathResult(List<String> path, int minutes) {
            this.path = path;
            this.minutes = minutes;
        }
    }

    // ---------- Priority Engine ----------
    static class SmartPriorityCalculator implements PriorityCalculator {
        public double calculate(Emergency e) {
            double populationScore = Math.min(35.0, e.getPeopleAffected() / 40.0);
            double vulnerableScore = Math.min(25.0, e.getVulnerablePeople() / 20.0);
            double medicalScore = e.getMedicalUrgency() * 2.0;
            double riskScore = e.getRiskLevel() * 3.0;
            return Math.min(100.0,
                    (populationScore + vulnerableScore + medicalScore + riskScore)
                            * e.typeMultiplier());
        }
    }

    // ---------- Dijkstra Route Planner ----------
    static class DijkstraRoutePlanner implements RoutePlanner {
        public List<String> shortestRoute(String start, String destination,
                                          Map<String, List<Road>> graph) {
            if (!graph.containsKey(start) || !graph.containsKey(destination)) return List.of();

            Map<String, Integer> dist = new HashMap<>();
            Map<String, String> prev = new HashMap<>();
            PriorityQueue<String> pq = new PriorityQueue<>(
                    Comparator.comparingInt(n -> dist.getOrDefault(n, Integer.MAX_VALUE)));

            for (String node : graph.keySet()) dist.put(node, Integer.MAX_VALUE);
            dist.put(start, 0);
            pq.add(start);

            while (!pq.isEmpty()) {
                String u = pq.poll();
                if (u.equals(destination)) break;

                for (Road r : graph.getOrDefault(u, List.of())) {
                    if (r.blocked) continue;
                    int nd = dist.get(u) + r.minutes;
                    if (nd < dist.getOrDefault(r.to, Integer.MAX_VALUE)) {
                        dist.put(r.to, nd);
                        prev.put(r.to, u);
                        pq.remove(r.to);
                        pq.add(r.to);
                    }
                }
            }

            if (dist.get(destination) == Integer.MAX_VALUE) return List.of();

            LinkedList<String> path = new LinkedList<>();
            String cur = destination;
            while (cur != null) {
                path.addFirst(cur);
                cur = prev.get(cur);
            }
            return path;
        }

        public PathResult routeWithTime(String start, String destination,
                                        Map<String, List<Road>> graph) {
            List<String> path = shortestRoute(start, destination, graph);
            if (path.isEmpty()) return new PathResult(List.of(), -1);

            int total = 0;
            for (int i = 0; i < path.size() - 1; i++) {
                String from = path.get(i);
                String to = path.get(i + 1);
                for (Road r : graph.get(from)) {
                    if (r.to.equals(to)) {
                        total += r.minutes;
                        break;
                    }
                }
            }
            return new PathResult(path, total);
        }
    }

    // ---------- Application ----------
    static class CivicShieldApp {
        final List<Emergency> emergencies = new ArrayList<>();
        final Map<String, Resource> resources = new HashMap<>();
        final List<Shelter> shelters = new ArrayList<>();
        final Map<String, List<Road>> graph = new HashMap<>();
        final PriorityCalculator priorityCalculator = new SmartPriorityCalculator();
        final DijkstraRoutePlanner routePlanner = new DijkstraRoutePlanner();

        CivicShieldApp() {
            seedResources();
            seedShelters();
            seedGraph();
            loadEmergencies();
        }

        void seedResources() {
            resources.put("AMB", new Resource("R01", "AMBULANCE", 5));
            resources.put("RES", new Resource("R02", "RESCUE_TEAM", 3));
            resources.put("MED", new Resource("R03", "MEDICAL_KIT", 250));
            resources.put("BUS", new Resource("R04", "EVAC_BUS", 4));
        }

        void seedShelters() {
            shelters.add(new Shelter("S1", "A", 700, 420));
            shelters.add(new Shelter("S2", "C", 500, 200));
            shelters.add(new Shelter("S3", "F", 900, 300));
            shelters.add(new Shelter("S4", "G", 350, 100));
        }

        void seedGraph() {
            for (String n : List.of("A","B","C","D","E","F","G","S1","S2","S3","S4"))
                graph.put(n, new ArrayList<>());

            addRoad("A","B",4,false);
            addRoad("A","D",6,false);
            addRoad("B","C",5,false);
            addRoad("B","E",3,false);
            addRoad("C","F",4,false);
            addRoad("D","E",2,false);
            addRoad("E","F",3,false);
            addRoad("E","G",5,false);
            addRoad("F","S3",2,false);
            addRoad("C","S2",3,false);
            addRoad("G","S4",2,false);
            addRoad("A","S1",3,false);

            // Alternate return edges
            addRoad("B","A",4,false);
            addRoad("D","A",6,false);
            addRoad("C","B",5,false);
            addRoad("E","B",3,false);
            addRoad("F","C",4,false);
            addRoad("E","D",2,false);
            addRoad("F","E",3,false);
            addRoad("G","E",5,false);
            addRoad("S3","F",2,false);
            addRoad("S2","C",3,false);
            addRoad("S4","G",2,false);
            addRoad("S1","A",3,false);
        }

        void addRoad(String a, String b, int minutes, boolean blocked) {
            graph.computeIfAbsent(a, k -> new ArrayList<>()).add(new Road(b, minutes, blocked));
        }

        void loadEmergencies() {
            File f = new File(DATA_FILE);
            if (!f.exists()) return;
            try (BufferedReader br = new BufferedReader(new FileReader(f))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.isBlank() || line.startsWith("id,")) continue;
                    String[] p = line.split(",");
                    if (p.length < 7) continue;
                    Emergency e = makeEmergency(p[1], p[0], p[2],
                            Integer.parseInt(p[3]), Integer.parseInt(p[4]),
                            Integer.parseInt(p[5]), Integer.parseInt(p[6]));
                    if (e != null) emergencies.add(e);
                }
            } catch (Exception ex) {
                System.out.println("Could not load saved emergencies: " + ex.getMessage());
            }
        }

        void saveEmergencies() {
            try (PrintWriter pw = new PrintWriter(new FileWriter(DATA_FILE))) {
                pw.println("id,type,zone,peopleAffected,vulnerablePeople,medicalUrgency,riskLevel");
                for (Emergency e : emergencies) pw.println(e.toCsv());
            } catch (IOException ex) {
                System.out.println("Could not save data: " + ex.getMessage());
            }
        }

        Emergency makeEmergency(String type, String id, String zone, int people,
                                int vulnerable, int medical, int risk) {
            return switch (type.toUpperCase()) {
                case "FLOOD" -> new FloodEmergency(id, zone, people, vulnerable, medical, risk);
                case "FIRE" -> new FireEmergency(id, zone, people, vulnerable, medical, risk);
                case "MEDICAL" -> new MedicalEmergency(id, zone, people, vulnerable, medical, risk);
                case "HEAT" -> new HeatEmergency(id, zone, people, vulnerable, medical, risk);
                default -> null;
            };
        }

        void addEmergency() {
            try {
                System.out.print("Emergency ID: ");
                String id = sc.nextLine().trim();
                System.out.print("Type (FLOOD/FIRE/MEDICAL/HEAT): ");
                String type = sc.nextLine().trim().toUpperCase();
                System.out.print("Zone (A-G): ");
                String zone = sc.nextLine().trim().toUpperCase();
                System.out.print("People affected: ");
                int people = Integer.parseInt(sc.nextLine());
                System.out.print("Vulnerable people: ");
                int vulnerable = Integer.parseInt(sc.nextLine());
                System.out.print("Medical urgency (1-10): ");
                int medical = Integer.parseInt(sc.nextLine());
                System.out.print("Risk level (1-10): ");
                int risk = Integer.parseInt(sc.nextLine());

                if (people <= 0 || vulnerable < 0 || vulnerable > people ||
                        medical < 1 || medical > 10 || risk < 1 || risk > 10) {
                    throw new IllegalArgumentException("Values are outside valid ranges.");
                }

                Emergency e = makeEmergency(type, id, zone, people, vulnerable, medical, risk);
                if (e == null) throw new IllegalArgumentException("Unsupported emergency type.");

                emergencies.add(e);
                saveEmergencies();
                System.out.printf("Emergency registered. Priority Score = %.2f%n",
                        priorityCalculator.calculate(e));
            } catch (Exception ex) {
                System.out.println("INPUT ERROR: " + ex.getMessage());
            }
        }

        PriorityQueue<Emergency> priorityQueue() {
            PriorityQueue<Emergency> pq = new PriorityQueue<>(
                    Comparator.comparingDouble(priorityCalculator::calculate).reversed());
            pq.addAll(emergencies);
            return pq;
        }

        void showQueue() {
            if (emergencies.isEmpty()) {
                System.out.println("No emergencies registered.");
                return;
            }
            System.out.println("\nEMERGENCY PRIORITY QUEUE");
            System.out.println("---------------------------------------------------------------");
            System.out.printf("%-6s %-10s %-7s %-10s %-10s%n",
                    "ID", "TYPE", "ZONE", "PEOPLE", "SCORE");
            System.out.println("---------------------------------------------------------------");
            for (Emergency e : priorityQueue()) {
                System.out.printf("%-6s %-10s %-7s %-10d %-10.2f%n",
                        e.getId(), e.type(), e.getZone(), e.getPeopleAffected(),
                        priorityCalculator.calculate(e));
            }
        }

        void allocateResources() {
            if (emergencies.isEmpty()) {
                System.out.println("Add emergencies first.");
                return;
            }

            int ambulances = resources.get("AMB").getQuantity();
            int teams = resources.get("RES").getQuantity();
            int kits = resources.get("MED").getQuantity();

            System.out.println("\nSMART RESOURCE ALLOCATION");
            System.out.println("Available: " + ambulances + " ambulances, " +
                    teams + " rescue teams, " + kits + " medical kits");

            int rank = 1;
            for (Emergency e : priorityQueue()) {
                boolean amb = ambulances > 0;
                boolean team = teams > 0;
                int requestedKits = Math.min(40, Math.max(10, e.getVulnerablePeople() / 2));

                if (amb) ambulances--;
                if (team) teams--;
                int givenKits = Math.min(kits, requestedKits);
                kits -= givenKits;

                System.out.printf("%d. %s | score %.2f | ambulance=%s | rescueTeam=%s | kits=%d%n",
                        rank++, e.getId(), priorityCalculator.calculate(e),
                        amb ? "YES" : "NO", team ? "YES" : "NO", givenKits);
            }
            System.out.println("Allocation is priority-driven; lower-priority incidents receive remaining resources.");
        }

        void routePlanner() {
            System.out.print("Start zone (A-G): ");
            String start = sc.nextLine().trim().toUpperCase();
            System.out.print("Destination shelter (S1-S4): ");
            String destination = sc.nextLine().trim().toUpperCase();

            PathResult result = routePlanner.routeWithTime(start, destination, graph);
            if (result.path.isEmpty()) {
                System.out.println("No safe route available.");
            } else {
                System.out.println("Safe route: " + String.join(" -> ", result.path));
                System.out.println("Estimated travel time: " + result.minutes + " minutes");
            }
        }

        void showShelters() {
            System.out.println("\nSHELTER CAPACITY");
            for (Shelter s : shelters) System.out.println(s);
        }

        void whatIfSimulation() {
            if (emergencies.isEmpty()) {
                System.out.println("Add at least one emergency first.");
                return;
            }

            System.out.println("\nWHAT-IF SIMULATION");
            System.out.println("1. Increase disaster risk by 2");
            System.out.println("2. Reduce ambulances by 3");
            System.out.println("3. Reduce shelter S3 capacity by 400");
            System.out.print("Choose scenario: ");

            try {
                int choice = Integer.parseInt(sc.nextLine());
                switch (choice) {
                    case 1 -> {
                        System.out.println("BEFORE -> AFTER PRIORITY");
                        for (Emergency e : emergencies) {
                            double before = priorityCalculator.calculate(e);
                            e.setRiskLevel(Math.min(10, e.getRiskLevel() + 2));
                            double after = priorityCalculator.calculate(e);
                            System.out.printf("%s: %.2f -> %.2f%n", e.getId(), before, after);
                        }
                        saveEmergencies();
                    }
                    case 2 -> {
                        int before = resources.get("AMB").getQuantity();
                        int after = Math.max(0, before - 3);
                        resources.get("AMB").allocate(Math.min(3, before));
                        System.out.println("Ambulances: " + before + " -> " + after);
                        System.out.println("The allocation engine would now prioritize only the highest-risk incidents.");
                    }
                    case 3 -> {
                        Shelter target = shelters.stream()
                                .filter(s -> s.getId().equals("S3")).findFirst().orElse(null);
                        if (target == null) return;
                        System.out.println("S3 available capacity before: " + target.available());
                        int simulatedAvailable = Math.max(0, target.available() - 400);
                        System.out.println("S3 simulated available capacity: " + simulatedAvailable);
                        System.out.println("Overflow should be redirected to S2 or S4.");
                    }
                    default -> System.out.println("Invalid scenario.");
                }
            } catch (Exception ex) {
                System.out.println("Simulation error: " + ex.getMessage());
            }
        }

        void concurrentSimulation() {
            if (emergencies.isEmpty()) {
                System.out.println("Add emergencies first.");
                return;
            }

            System.out.println("\nMULTI-INCIDENT SIMULATION");
            ExecutorService pool = Executors.newFixedThreadPool(Math.min(4, emergencies.size()));
            List<Callable<String>> jobs = new ArrayList<>();

            for (Emergency e : emergencies) {
                jobs.add(() -> {
                    Thread.sleep(100);
                    return Thread.currentThread().getName() + " processed " + e.getId()
                            + " (" + e.type() + "), score="
                            + String.format("%.2f", priorityCalculator.calculate(e));
                });
            }

            try {
                for (Future<String> f : pool.invokeAll(jobs)) System.out.println(f.get());
            } catch (Exception ex) {
                System.out.println("Concurrent simulation error: " + ex.getMessage());
            } finally {
                pool.shutdown();
            }
        }

        void impactReport() {
            int people = emergencies.stream().mapToInt(Emergency::getPeopleAffected).sum();
            int vulnerable = emergencies.stream().mapToInt(Emergency::getVulnerablePeople).sum();
            double avg = emergencies.stream().mapToDouble(priorityCalculator::calculate).average().orElse(0);

            System.out.println("\nCIVIC-SHIELD IMPACT REPORT");
            System.out.println("--------------------------------------");
            System.out.println("Active emergency reports : " + emergencies.size());
            System.out.println("People potentially affected : " + people);
            System.out.println("Vulnerable people : " + vulnerable);
            System.out.printf("Average priority score : %.2f%n", avg);
            System.out.println("Decision model : risk + population + vulnerability + medical urgency");
            System.out.println("Routing model : Dijkstra shortest safe path");
            System.out.println("Persistence : CSV file handling");
        }

        void run() {
            while (true) {
                System.out.println("\n==============================================");
                System.out.println("             CIVIC-SHIELD v1.0");
                System.out.println(" URBAN EMERGENCY DECISION SUPPORT SYSTEM");
                System.out.println("==============================================");
                System.out.println("1. Report Emergency");
                System.out.println("2. View Emergency Priority Queue");
                System.out.println("3. Allocate Resources");
                System.out.println("4. Find Safe Evacuation Route");
                System.out.println("5. View Shelter Capacity");
                System.out.println("6. Run What-If Simulation");
                System.out.println("7. Run Multi-Incident Simulation");
                System.out.println("8. Generate SDG Impact Report");
                System.out.println("9. Exit");
                System.out.print("Enter choice: ");

                String choice = sc.nextLine();
                switch (choice) {
                    case "1" -> addEmergency();
                    case "2" -> showQueue();
                    case "3" -> allocateResources();
                    case "4" -> routePlanner();
                    case "5" -> showShelters();
                    case "6" -> whatIfSimulation();
                    case "7" -> concurrentSimulation();
                    case "8" -> impactReport();
                    case "9" -> {
                        saveEmergencies();
                        System.out.println("CIVIC-SHIELD closed safely.");
                        return;
                    }
                    default -> System.out.println("Invalid menu option.");
                }
            }
        }
    }

    public static void main(String[] args) {
        new CivicShieldApp().run();
    }
}
