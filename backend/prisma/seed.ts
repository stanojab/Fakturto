// Seed: napolni prazno bazo z izmišljenimi, a realističnimi podatki (Faker, slovenski jezik).
// Zagon: npm run db:seed   |   Ponovni zagon na prazni bazi: npx prisma migrate reset
import { randomUUID } from "node:crypto";
import { fakerSL_SI as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Prisma,
  type InvoiceStatus,
  type ExtractionMethod,
} from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) process.loadEnvFile("../.env");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Vedno isti podatki ob vsakem zagonu (ponovljivo – koristno za podatkovni predmet)
faker.seed(42);

// ---------- Nastavitve količin ----------
const COUNTS = {
  extraAccountants: 7,
  clientUsers: 50,
  clients: 200,
  invoices: 6000,
};
const PLACEHOLDER_PASSWORD_HASH = "!seed-no-login"; // prava gesla pridejo z issue #9 (prijava)

// ---------- Pomožne funkcije ----------
const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slugify = (s: string) =>
  ascii(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const iban = () => `SI56${faker.string.numeric(15)}`;
const taxNumber = () => faker.string.numeric({ length: 8, allowLeadingZeros: false });
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
const minDate = (a: Date, b: Date) => (a < b ? a : b);

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 1000) await insert(rows.slice(i, i + 1000));
}

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log("Baza ni prazna – seed preskočen. Za ponovni začetek: npx prisma migrate reset");
    return;
  }

  // ---------- Uporabniki ----------
  const users: Prisma.UserCreateManyInput[] = [];
  const makeUser = (
    email: string,
    fullName: string,
    firmRole: "ADMIN" | "ACCOUNTANT" | null,
  ): Prisma.UserCreateManyInput => {
    const createdAt = faker.date.past({ years: 2 });
    return {
      id: randomUUID(),
      email,
      passwordHash: PLACEHOLDER_PASSWORD_HASH,
      fullName,
      firmRole,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
  };

  // Fiksni testni uporabniki – po en za vsako vlogo
  const admin = makeUser("admin@fakturko.test", "Ana Administrator", "ADMIN");
  const testAccountant = makeUser("racunovodja@fakturko.test", "Rok Računovodja", "ACCOUNTANT");
  const testClientUser = makeUser("stranka@fakturko.test", "Sara Stranka", null);
  users.push(admin, testAccountant, testClientUser);

  const randomPerson = (i: number, domain: string, role: "ACCOUNTANT" | null) => {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    return makeUser(`${ascii(first)}.${ascii(last)}.${i}@${domain}`, `${first} ${last}`, role);
  };

  const accountants = [testAccountant];
  for (let i = 0; i < COUNTS.extraAccountants; i++) {
    const u = randomPerson(i, "fakturko.test", "ACCOUNTANT");
    accountants.push(u);
    users.push(u);
  }
  // Približno 10 % računovodij je deaktiviranih (mehko brisanje)
  accountants.at(-1)!.isActive = false;

  const clientUsers = [testClientUser];
  for (let i = 0; i < COUNTS.clientUsers; i++) {
    const u = randomPerson(i, "example.com", null);
    clientUsers.push(u);
    users.push(u);
  }

  // ---------- Stranke (podjetja) ----------
  const industries = [
    "trgovina",
    "gradnje",
    "storitve",
    "servis",
    "transport",
    "IT",
    "gostinstvo",
    "svetovanje",
  ];
  const legalForms = ["d.o.o.", "d.o.o.", "d.o.o.", "s.p.", "d.d."];
  const usedTax = new Set<string>();

  const clients: Prisma.ClientCreateManyInput[] = [];
  for (let i = 0; i < COUNTS.clients; i++) {
    const name = `${faker.person.lastName()} ${faker.helpers.arrayElement(industries)} ${faker.helpers.arrayElement(legalForms)}`;
    let tax = taxNumber();
    while (usedTax.has(tax)) tax = taxNumber();
    usedTax.add(tax);
    const createdAt = faker.date.past({ years: 2 });
    clients.push({
      id: randomUUID(),
      name,
      taxNumber: tax,
      registrationNumber:
        faker.helpers.maybe(() => faker.string.numeric(10), { probability: 0.8 }) ?? null,
      address: `${faker.location.street()} ${faker.location.buildingNumber()}, ${faker.location.zipCode()} ${faker.location.city()}`,
      iban: iban(),
      paymentMode: faker.helpers.weightedArrayElement([
        { weight: 7, value: "ACCOUNTANT_PAYS" as const },
        { weight: 3, value: "CLIENT_PAYS" as const },
      ]),
      slug: `${slugify(name)}-${i}`,
      isActive: faker.datatype.boolean({ probability: 0.95 }),
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ---------- Članstva (uporabnik ↔ stranka) ----------
  const membershipKeys = new Set<string>();
  const memberships: Prisma.ClientMembershipCreateManyInput[] = [];
  const membersByClient = new Map<string, string[]>();
  const addMembership = (userId: string, clientId: string) => {
    const key = `${userId}:${clientId}`;
    if (membershipKeys.has(key)) return;
    membershipKeys.add(key);
    const createdAt = faker.date.past({ years: 1 });
    memberships.push({ id: randomUUID(), userId, clientId, createdAt, updatedAt: createdAt });
    membersByClient.set(clientId, [...(membersByClient.get(clientId) ?? []), userId]);
  };
  // Testna stranka je članica dveh podjetij (zahteva issue #7)
  addMembership(testClientUser.id!, clients[0].id!);
  addMembership(testClientUser.id!, clients[1].id!);
  // Vsako podjetje ima vsaj enega člana (krožno), nekaj uporabnikov pa je članov več podjetij
  clients
    .slice(2)
    .forEach((c, i) => addMembership(clientUsers[1 + (i % COUNTS.clientUsers)].id!, c.id!));
  for (let i = 0; i < 50; i++) {
    addMembership(
      faker.helpers.arrayElement(clientUsers).id!,
      faker.helpers.arrayElement(clients).id!,
    );
  }

  // ---------- Dodelitve računovodij ----------
  const assignments: Prisma.AccountantAssignmentCreateManyInput[] = [];
  const accountantsByClient = new Map<string, string[]>();
  clients.forEach((c, i) => {
    const ids = [accountants[i % accountants.length].id!];
    if (faker.datatype.boolean({ probability: 0.25 })) {
      const second = faker.helpers.arrayElement(accountants).id!;
      if (second !== ids[0]) ids.push(second);
    }
    accountantsByClient.set(c.id!, ids);
    for (const accountantId of ids) {
      const createdAt = faker.date.past({ years: 1 });
      assignments.push({
        id: randomUUID(),
        accountantId,
        clientId: c.id!,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  // ---------- Računi, datoteke, obvestila ----------
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const documents: Prisma.DocumentCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];

  const statusWeights: { weight: number; value: InvoiceStatus }[] = [
    { weight: 45, value: "PAID" },
    { weight: 15, value: "ARCHIVED" },
    { weight: 10, value: "READY_FOR_PAYMENT" },
    { weight: 10, value: "IN_REVIEW" },
    { weight: 5, value: "RETURNED" },
    { weight: 3, value: "REJECTED" },
    { weight: 5, value: "PROCESSING" },
    { weight: 7, value: "UPLOADED" },
  ];
  const returnReasons = [
    "Račun ni čitljiv, prosim naložite boljšo fotografijo.",
    "Račun ni izdan na vaše podjetje.",
    "Manjka druga stran računa.",
  ];
  const rejectReasons = ["Podvojen račun – že plačan.", "Račun je bil storniran."];
  const fileTypes = [
    { weight: 7, value: { mime: "application/pdf", ext: "pdf" } },
    { weight: 2, value: { mime: "image/jpeg", ext: "jpg" } },
    { weight: 1, value: { mime: "image/png", ext: "png" } },
  ];
  const suppliers = Array.from({ length: 80 }, () => ({
    name: `${faker.person.lastName()} ${faker.helpers.arrayElement(industries)} d.o.o.`,
    taxNumber: taxNumber(),
    iban: iban(),
  }));
  const now = new Date();

  for (let i = 0; i < COUNTS.invoices; i++) {
    const client = faker.helpers.arrayElement(clients);
    const status = faker.helpers.weightedArrayElement(statusWeights);
    const uploaderId = faker.helpers.arrayElement(membersByClient.get(client.id!)!);
    const clientAccountants = accountantsByClient.get(client.id!)!;

    // Novi računi so nedavni, ostali so razporejeni v zadnjih 18 mesecih
    const isFresh = status === "UPLOADED" || status === "PROCESSING";
    const createdAt = isFresh
      ? faker.date.recent({ days: 3 })
      : faker.date.between({ from: addDays(now, -540), to: addDays(now, -2) });

    const invoice: Prisma.InvoiceCreateManyInput = {
      id: randomUUID(),
      clientId: client.id!,
      uploadedById: uploaderId,
      status,
      currency: "EUR",
      createdAt,
      updatedAt: createdAt,
    };

    // Podatki so prebrani za vse statuse razen UPLOADED in PROCESSING
    if (!isFresh) {
      const supplier = faker.helpers.arrayElement(suppliers);
      const method: ExtractionMethod = faker.helpers.weightedArrayElement([
        { weight: 60, value: "UPN_QR" as const },
        { weight: 35, value: "AI" as const },
        { weight: 5, value: "MANUAL" as const },
      ]);
      const issueDate = addDays(createdAt, -faker.number.int({ min: 0, max: 5 }));
      const dueDate = addDays(issueDate, faker.helpers.arrayElement([8, 15, 30, 30, 45, 60]));
      const invoiceNumber = `${issueDate.getFullYear()}-${faker.string.numeric(5)}`;
      Object.assign(invoice, {
        extractionMethod: method,
        extractionConfidence:
          method === "AI"
            ? {
                issuer_iban: faker.number.float({ min: 0.7, max: 1, fractionDigits: 2 }),
                amount: faker.number.float({ min: 0.8, max: 1, fractionDigits: 2 }),
                due_date: faker.number.float({ min: 0.6, max: 1, fractionDigits: 2 }),
              }
            : undefined,
        issuerName: supplier.name,
        issuerTaxNumber: supplier.taxNumber,
        issuerIban: supplier.iban,
        recipientName: client.name,
        invoiceNumber,
        issueDate,
        dueDate,
        // Znesek kot niz – nikoli float (Decimal(12,2))
        amount: faker.finance.amount({ min: 5, max: 4000, dec: 2 }),
        paymentReference: `SI00 ${faker.string.numeric(8)}`,
        paymentPurpose: `Plačilo računa ${invoiceNumber}`,
      } satisfies Partial<Prisma.InvoiceCreateManyInput>);

      // Pregledani računi: računovodja je potrdil podatke
      if (["READY_FOR_PAYMENT", "PAID", "ARCHIVED", "REJECTED"].includes(status)) {
        invoice.reviewedById = faker.helpers.arrayElement(clientAccountants);
        invoice.reviewedAt = addHours(createdAt, faker.number.int({ min: 1, max: 48 }));
        invoice.updatedAt = invoice.reviewedAt;
      }

      // Plačani računi: kdo plača, je odvisno od načina plačila stranke
      if (status === "PAID" || status === "ARCHIVED") {
        const reviewedAt = invoice.reviewedAt as Date;
        invoice.paidById =
          client.paymentMode === "CLIENT_PAYS"
            ? uploaderId
            : faker.helpers.arrayElement(clientAccountants);
        const paidOn = minDate(
          addDays(reviewedAt, faker.number.int({ min: 0, max: 20 })),
          addDays(now, -1),
        );
        invoice.paidOn = paidOn;
        invoice.updatedAt = status === "ARCHIVED" ? addDays(paidOn, 30) : paidOn;
        if (invoice.updatedAt > now) invoice.updatedAt = now;
      }

      if (status === "RETURNED") invoice.statusReason = faker.helpers.arrayElement(returnReasons);
      if (status === "REJECTED") invoice.statusReason = faker.helpers.arrayElement(rejectReasons);
    }

    invoices.push(invoice);

    // Izvirnik računa
    const file = faker.helpers.weightedArrayElement(fileTypes);
    const addDocument = (
      kind: "ORIGINAL" | "PAYMENT_CONFIRMATION",
      uploadedById: string,
      at: Date,
    ) => {
      const id = randomUUID();
      const month = String(at.getMonth() + 1).padStart(2, "0");
      const ext = kind === "ORIGINAL" ? file.ext : "pdf";
      documents.push({
        id,
        invoiceId: invoice.id!,
        kind,
        storageKey: `clients/${client.slug}/${at.getFullYear()}/${month}/${id}.${ext}`,
        originalFilename:
          kind === "ORIGINAL" ? `racun_${faker.string.numeric(4)}.${ext}` : `potrdilo_placila.pdf`,
        mimeType: kind === "ORIGINAL" ? file.mime : "application/pdf",
        sizeBytes: faker.number.int({ min: 40_000, max: 5_000_000 }),
        sha256: faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
        uploadedById,
        createdAt: at,
        updatedAt: at,
      });
    };
    addDocument("ORIGINAL", uploaderId, createdAt);

    // Potrdilo o plačilu pri približno tretjini plačanih računov
    if (invoice.paidOn && faker.datatype.boolean({ probability: 0.3 })) {
      addDocument("PAYMENT_CONFIRMATION", invoice.paidById!, invoice.paidOn as Date);
    }

    // Obvestila stranki ob vrnitvi in (delno) ob plačilu
    const notify = (type: string, message: string, at: Date) => {
      notifications.push({
        id: randomUUID(),
        userId: uploaderId,
        invoiceId: invoice.id!,
        type,
        message,
        readAt: faker.datatype.boolean({ probability: 0.7 })
          ? addHours(at, faker.number.int({ min: 1, max: 72 }))
          : null,
        createdAt: at,
        updatedAt: at,
      });
    };
    if (status === "RETURNED") {
      notify(
        "INVOICE_RETURNED",
        `Račun ${invoice.invoiceNumber} je bil vrnjen: ${invoice.statusReason}`,
        addHours(createdAt, 24),
      );
    }
    if (invoice.paidOn && faker.datatype.boolean({ probability: 0.4 })) {
      notify("INVOICE_PAID", `Račun ${invoice.invoiceNumber} je plačan.`, invoice.paidOn as Date);
    }
  }

  // ---------- Vpis v bazo (v pravem vrstnem redu zaradi tujih ključev) ----------
  await prisma.user.createMany({ data: users });
  await prisma.client.createMany({ data: clients });
  await prisma.clientMembership.createMany({ data: memberships });
  await prisma.accountantAssignment.createMany({ data: assignments });
  await insertInChunks(invoices, (data) => prisma.invoice.createMany({ data }));
  await insertInChunks(documents, (data) => prisma.document.createMany({ data }));
  await insertInChunks(notifications, (data) => prisma.notification.createMany({ data }));

  const total =
    users.length +
    clients.length +
    memberships.length +
    assignments.length +
    invoices.length +
    documents.length +
    notifications.length;
  console.table({
    users: users.length,
    clients: clients.length,
    client_memberships: memberships.length,
    accountant_assignments: assignments.length,
    invoices: invoices.length,
    documents: documents.length,
    notifications: notifications.length,
  });
  console.log(`Skupaj: ${total} zapisov`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
