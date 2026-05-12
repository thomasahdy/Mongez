import { useEffect} from "react";
import SpaceCard from "./SpaceCard";
import SpacesHeader from "./SpacesHeader";
import CreateSpaceCard from "./CreateSpaceCard";
import QuotaBanner from "./QuotaBanner";
 
const SPACES_DATA = [
  {
    id: "upper-egypt-edu",
    initials: "UE",
    gradient: "from-indigo-500 to-indigo-400",
    name: "Upper Egypt Education",
    isOwner: true,
    stats: { departments: 3, boards: 7, members: 12 },
    departments: [
      {
        id: "design-ux",
        icon: "fa-palette",
        iconBg: "bg-sky-100 dark:bg-sky-900/30",
        iconColor: "text-sky-500",
        name: "Design & UX",
        lead: "Sarah Miller",
        memberCount: 4,
        stats: { boards: 3, tasks: 45 },
        boards: [
          { id: "lp-redesign",   icon: "fa-table-columns", label: "Landing Page Redesign", archived: false },
          { id: "design-system", icon: "fa-list",           label: "Design System",         archived: false },
          { id: "old-branding",  icon: "fa-box-archive",    label: "Old Branding",           archived: true  },
        ],
      },
      {
        id: "engineering",
        icon: "fa-code",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-500",
        name: "Engineering",
        lead: "Marcus Reed",
        memberCount: 6,
        stats: { boards: 2, tasks: 89 },
        boards: [
          { id: "backend-api",     icon: "fa-table-columns", label: "Backend API v2",  archived: false },
          { id: "student-portal",  icon: "fa-list",           label: "Student Portal",  archived: false },
        ],
      },
      {
        id: "marketing",
        icon: "fa-bullhorn",
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-500",
        name: "Marketing",
        lead: "Emma Davis",
        memberCount: 2,
        stats: { boards: 2, tasks: 23 },
        boards: [
          { id: "social-media",    icon: "fa-table-columns", label: "Social Media Campaign", archived: false },
          { id: "content-cal",     icon: "fa-list",           label: "Content Calendar",       archived: false },
        ],
      },
    ],
  },
  {
    id: "al-noor-foundation",
    initials: "AN",
    gradient: "from-emerald-500 to-emerald-400",
    name: "Al-Noor Foundation",
    isOwner: false,
    stats: { departments: 2, boards: 4, members: 8 },
    departments: [
      {
        id: "programs-impact",
        icon: "fa-heart-pulse",
        iconBg: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-500",
        name: "Programs & Impact",
        lead: "Fatma Ali",
        memberCount: 5,
        stats: { boards: 2, tasks: 34 },
        boards: [],
      },
      {
        id: "finance-ops",
        icon: "fa-coins",
        iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
        iconColor: "text-indigo-500",
        name: "Finance & Operations",
        lead: "Ahmed Hassan",
        memberCount: 3,
        stats: { boards: 2, tasks: 18 },
        boards: [],
      },
    ],
  },
];
 
const QUOTA = { used: 2, total: 5 };

 let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"Spaces & Structure",
    color:"text-slate-800",
    ref:""
  },
  
]
 
export default function SpacesPagee({setPath}) {
  const remaining = QUOTA.total - QUOTA.used;
  useEffect(()=>{
      setPath(path)
    }, [path]);
 
  return (
    <>
      {/* Font Awesome — load via <link> in index.html in production */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
 
 
        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
 
          {/* Scrollable content area */}
          <main className="flex-1 overflow-y-auto px-8 py-8" aria-label="Spaces and structure">
            <div className="max-w-[1100px] mx-auto">
 
              <SpacesHeader onNewSpace={() => console.info("New space")} />
 
              <QuotaBanner
                used={QUOTA.used}
                total={QUOTA.total}
                onUpgrade={() => console.info("Upgrade")}
              />
 
              {/* Space cards */}
              <div className="flex flex-col gap-6" role="list" aria-label="Spaces">
                {SPACES_DATA.map((space) => (
                  <div key={space.id} role="listitem">
                    <SpaceCard space={space} />
                  </div>
                ))}
 
                {/* Create new */}
                <CreateSpaceCard
                  remaining={remaining}
                  onClick={() => console.info("Create space")}
                />
              </div>
            </div>
          </main>
        </div>
    </>
  );
}