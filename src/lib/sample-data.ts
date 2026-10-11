export type Student = {
  id: string;
  name: string;
  guardian: string;
  group: string;
  initials: string;
  due: number;
  paid: number;
  dueDate: string;
};
export const students: Student[] = [
  {
    id: "ST-001",
    name: "Aarav Sharma",
    guardian: "Sanjay Sharma",
    group: "Class 10 • Science",
    initials: "AS",
    due: 2500,
    paid: 1500,
    dueDate: "2026-10-05",
  },
  {
    id: "ST-002",
    name: "Ananya Verma",
    guardian: "Sunita Verma",
    group: "Class 10 • Science",
    initials: "AV",
    due: 0,
    paid: 4000,
    dueDate: "2026-10-05",
  },
  {
    id: "ST-003",
    name: "Mohammad Ayaan",
    guardian: "Imran Khan",
    group: "Class 12 • Mathematics",
    initials: "MA",
    due: 3200,
    paid: 1800,
    dueDate: "2026-10-07",
  },
  {
    id: "ST-004",
    name: "Kavya Patel",
    guardian: "Rajesh Patel",
    group: "Class 10 • Science",
    initials: "KP",
    due: 0,
    paid: 4000,
    dueDate: "2026-10-05",
  },
  {
    id: "ST-005",
    name: "Vivaan Gupta",
    guardian: "Neeraj Gupta",
    group: "Class 12 • Mathematics",
    initials: "VG",
    due: 1500,
    paid: 3500,
    dueDate: "2026-10-07",
  },
  {
    id: "ST-006",
    name: "Siya Singh",
    guardian: "Pooja Singh",
    group: "Class 8 • All subjects",
    initials: "SS",
    due: 0,
    paid: 2500,
    dueDate: "2026-10-10",
  },
];
export const batches = [
  {
    name: "Class 10 • Science",
    time: "04:00 – 05:00 PM",
    room: "Room 01",
    teacher: "Ms. Neha",
    count: 3,
  },
  {
    name: "Class 12 • Mathematics",
    time: "05:00 – 06:00 PM",
    room: "Room 02",
    teacher: "Mr. Amit",
    count: 2,
  },
  {
    name: "Class 8 • All subjects",
    time: "06:00 – 07:00 PM",
    room: "Room 01",
    teacher: "Ms. Neha",
    count: 1,
  },
];
export const sampleDate = "2026-10-02";
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
