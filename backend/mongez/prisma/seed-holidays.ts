import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in the environment variables');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface Holiday {
  date: string;       // YYYY-MM-DD
  localName: string;
  name: string;
}

// Approximate Gregorian dates for Islamic holidays (1 Shawwal for Eid Al-Fitr, 10 Zul-Hijjah for Eid Al-Adha)
// from 2026 to 2035
const ISLAMIC_HOLIDAYS_ESTIMATES: Record<number, { eidFitr: string; arafat: string; eidAdha: string; hijriNewYear: string; prophetBirthday: string }> = {
  2026: {
    eidFitr: '2026-03-20',
    arafat: '2026-05-26',
    eidAdha: '2026-05-27',
    hijriNewYear: '2026-06-16',
    prophetBirthday: '2026-08-25',
  },
  2027: {
    eidFitr: '2027-03-09',
    arafat: '2027-05-15',
    eidAdha: '2027-05-16',
    hijriNewYear: '2027-06-05',
    prophetBirthday: '2027-08-14',
  },
  2028: {
    eidFitr: '2028-02-26',
    arafat: '2028-05-03',
    eidAdha: '2028-05-04',
    hijriNewYear: '2028-05-24',
    prophetBirthday: '2028-08-02',
  },
  2029: {
    eidFitr: '2029-02-15',
    arafat: '2029-04-22',
    eidAdha: '2029-04-23',
    hijriNewYear: '2029-05-13',
    prophetBirthday: '2029-07-22',
  },
  2030: {
    eidFitr: '2030-02-04',
    arafat: '2030-04-12',
    eidAdha: '2030-04-13',
    hijriNewYear: '2030-05-03',
    prophetBirthday: '2030-07-12',
  },
  2031: {
    eidFitr: '2031-01-24',
    arafat: '2031-04-02',
    eidAdha: '2031-04-03',
    hijriNewYear: '2031-04-22',
    prophetBirthday: '2031-07-01',
  },
  2032: {
    eidFitr: '2032-01-13',
    arafat: '2032-03-21',
    eidAdha: '2032-03-22',
    hijriNewYear: '2032-04-10',
    prophetBirthday: '2032-06-19',
  },
  2033: {
    eidFitr: '2033-01-02',
    arafat: '2033-03-10',
    eidAdha: '2033-03-11',
    hijriNewYear: '2033-03-30',
    prophetBirthday: '2033-06-08',
  },
  2034: {
    eidFitr: '2034-12-12',
    arafat: '2034-02-27',
    eidAdha: '2034-02-28',
    hijriNewYear: '2034-03-20',
    prophetBirthday: '2034-05-29',
  },
  2035: {
    eidFitr: '2035-12-01',
    arafat: '2035-02-17',
    eidAdha: '2035-02-18',
    hijriNewYear: '2035-03-10',
    prophetBirthday: '2035-05-18',
  },
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getHolidaysForCountry(country: string, year: number): Holiday[] {
  const holidays: Holiday[] = [];
  const est = ISLAMIC_HOLIDAYS_ESTIMATES[year];
  if (!est) return [];

  // Fixed holidays by country
  if (country === 'EG') {
    holidays.push(
      { date: `${year}-01-07`, localName: 'عيد الميلاد المجيد', name: 'Coptic Christmas' },
      { date: `${year}-01-25`, localName: 'ثورة ٢٥ يناير وعيد الشرطة', name: 'Revolution Day / Police Day' },
      { date: `${year}-04-25`, localName: 'عيد تحرير سيناء', name: 'Sinai Liberation Day' },
      { date: `${year}-05-01`, localName: 'عيد العمال', name: 'Labour Day' },
      { date: `${year}-06-30`, localName: 'ثورة ٣٠ يونيو', name: '30 June Revolution Day' },
      { date: `${year}-07-23`, localName: 'ثورة ٢٣ يوليو', name: 'July Revolution Day' },
      { date: `${year}-10-06`, localName: 'عيد القوات المسلحة', name: 'Armed Forces Day' }
    );
  } else if (country === 'SA') {
    holidays.push(
      { date: `${year}-02-22`, localName: 'يوم التأسيس السعودي', name: 'Founding Day' },
      { date: `${year}-09-23`, localName: 'اليوم الوطني للمملكة العربية السعودية', name: 'National Day' }
    );
  } else if (country === 'AE') {
    holidays.push(
      { date: `${year}-01-01`, localName: 'رأس السنة الميلادية', name: "New Year's Day" },
      { date: `${year}-11-30`, localName: 'يوم الشهيد', name: 'Commemoration Day' },
      { date: `${year}-12-02`, localName: 'اليوم الوطني الإماراتي', name: 'National Day' },
      { date: `${year}-12-03`, localName: 'عطلة اليوم الوطني', name: 'National Day Holiday' }
    );
  } else if (country === 'QA') {
    // Sports day is 2nd Tuesday of Feb. Let's calculate it.
    let sportsDay = 8; // earliest possible is 8th
    const firstFeb = new Date(year, 1, 1);
    const dayOfWeek = firstFeb.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue...
    if (dayOfWeek <= 2) {
      sportsDay = sportsDay - dayOfWeek;
    } else {
      sportsDay = sportsDay + (7 - dayOfWeek);
    }
    const sportsDayStr = `${year}-02-${sportsDay.toString().padStart(2, '0')}`;
    holidays.push(
      { date: sportsDayStr, localName: 'اليوم الرياضي للدولة', name: 'National Sports Day' },
      { date: `${year}-12-18`, localName: 'اليوم الوطني لقطر', name: 'National Day' }
    );
  } else if (country === 'KW') {
    holidays.push(
      { date: `${year}-01-01`, localName: 'رأس السنة الميلادية', name: "New Year's Day" },
      { date: `${year}-02-25`, localName: 'اليوم الوطني للكويت', name: 'National Day' },
      { date: `${year}-02-26`, localName: 'يوم التحرير للكويت', name: 'Liberation Day' }
    );
  }

  // Shared Islamic holidays (approximated)
  // Eid Al-Fitr (usually 3 days)
  holidays.push(
    { date: est.eidFitr, localName: 'عيد الفطر', name: 'Eid Al-Fitr' },
    { date: addDays(est.eidFitr, 1), localName: 'عطلة عيد الفطر', name: 'Eid Al-Fitr Holiday' },
    { date: addDays(est.eidFitr, 2), localName: 'عطلة عيد الفطر', name: 'Eid Al-Fitr Holiday' }
  );

  // Arafat Day and Eid Al-Adha (usually 3-4 days)
  holidays.push(
    { date: est.arafat, localName: 'وقفة عرفات', name: 'Arafat Day' },
    { date: est.eidAdha, localName: 'عيد الأضحى المبارك', name: 'Eid Al-Adha' },
    { date: addDays(est.eidAdha, 1), localName: 'عطلة عيد الأضحى', name: 'Eid Al-Adha Holiday' },
    { date: addDays(est.eidAdha, 2), localName: 'عطلة عيد الأضحى', name: 'Eid Al-Adha Holiday' }
  );

  // Hijri New Year
  holidays.push({ date: est.hijriNewYear, localName: 'رأس السنة الهجرية', name: 'Islamic New Year' });

  // Prophet's Birthday
  holidays.push({ date: est.prophetBirthday, localName: 'المولد النبوي الشريف', name: "Prophet's Birthday" });

  // Sort holidays by date
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  console.log('🌱 Seeding HolidayCache for years 2026 to 2035...');
  const countries = ['EG', 'SA', 'AE', 'QA', 'KW'];

  for (const country of countries) {
    console.log(`Seeding holidays for ${country}...`);
    for (let year = 2026; year <= 2035; year++) {
      const holidays = getHolidaysForCountry(country, year);
      
      await prisma.holidayCache.upsert({
        where: {
          country_year: {
            country,
            year,
          },
        },
        update: {
          holidays: holidays as any,
          fetchedAt: new Date(),
        },
        create: {
          country,
          year,
          holidays: holidays as any,
        },
      });
      console.log(`  ✓ Seeding year ${year} (${holidays.length} holidays)`);
    }
  }

  console.log('✅ Holiday cache seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
