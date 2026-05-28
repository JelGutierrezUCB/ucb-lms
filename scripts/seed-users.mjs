/**
 * UCB LMS — Full User Seed Script
 * Creates all users from the Master Roster:
 *   - Admins: David Krasnow, Zac Fratkin
 *   - Managers: Terry Nelson, Shane Janicki, Felix Diaz, Bradley Alexander,
 *               Anthony Sparks, Juanita Ford, Rebecca Fuget
 *   - Office employees (Zac's team, ~15)
 *   - Production workers (proxy-only, under each manager)
 *
 * Usage: node scripts/seed-users.mjs
 * Requires: .env.local with Supabase credentials
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_PASSWORD = 'UCBTraining2026!'

// Slugify name for proxy email: "John Smith" → "john.smith"
function slugName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')
}

async function createUser({ email, password, fullName, role, managerId, department }) {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const alreadyExists = existing?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (alreadyExists) {
    // Check if profile exists too
    const { data: prof } = await supabase.from('profiles').select('id').eq('id', alreadyExists.id).single()
    if (prof) {
      console.log(`  ⏩ Skipping (exists): ${fullName} <${email}>`)
      return alreadyExists.id
    }
    // Profile missing — insert it
    await supabase.from('profiles').insert({
      id: alreadyExists.id,
      email: email.toLowerCase(),
      full_name: fullName,
      role,
      manager_id: managerId || null,
      department: department || null,
      is_active: true,
    })
    console.log(`  ✅ Profile inserted (auth existed): ${fullName}`)
    return alreadyExists.id
  }

  // Create auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr) {
    console.error(`  ❌ Auth error for ${fullName}: ${authErr.message}`)
    return null
  }

  const userId = authData.user.id

  // Insert profile
  const { error: profErr } = await supabase.from('profiles').insert({
    id: userId,
    email: email.toLowerCase(),
    full_name: fullName,
    role,
    manager_id: managerId || null,
    department: department || null,
    is_active: true,
  })

  if (profErr) {
    console.error(`  ❌ Profile error for ${fullName}: ${profErr.message}`)
    return null
  }

  console.log(`  ✅ Created: ${fullName} <${email}> [${role}]`)
  return userId
}

async function main() {
  console.log('🚀 UCB LMS User Seed Script\n')

  // ─────────────────────────────────────────────
  // ADMINS
  // ─────────────────────────────────────────────
  console.log('📋 Creating Admins...')
  const davidId = await createUser({
    email: 'DavidKrasnow@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'David Krasnow',
    role: 'admin',
    department: 'Executive',
  })
  const zacId = await createUser({
    email: 'ZacFratkin@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Zac Fratkin',
    role: 'admin',
    department: 'Executive',
  })

  // ─────────────────────────────────────────────
  // MANAGERS
  // ─────────────────────────────────────────────
  console.log('\n📋 Creating Managers...')

  const terryId = await createUser({
    email: 'TerryNelson@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Terry Nelson',
    role: 'manager',
    department: 'Hannibal Production',
  })
  const shaneId = await createUser({
    email: 'ShaneJanicki@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Shane Janicki',
    role: 'manager',
    department: 'HVP - Hunt Valley Production',
  })
  const felixId = await createUser({
    email: 'FelixDiaz@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Felix Diaz',
    role: 'manager',
    department: 'ML - Milwaukee Production',
  })
  const bradleyId = await createUser({
    email: 'managerhv@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Bradley Alexander',
    role: 'manager',
    department: 'HV - Hunt Valley',
  })
  const anthonyId = await createUser({
    email: 'AnthonySparks@usedcardboardboxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Anthony Sparks',
    role: 'manager',
    department: 'HA - Hannibal',
  })
  const juanitaId = await createUser({
    email: 'JuanitaFord@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Juanita Ford',
    role: 'manager',
    department: 'MLC - McCormick',
  })
  const rebeccaId = await createUser({
    email: 'RebeccaFuget@UsedCardboardBoxes.com',
    password: DEFAULT_PASSWORD,
    fullName: 'Rebecca Fuget',
    role: 'manager',
    department: 'Hannibal Production',
  })

  // ─────────────────────────────────────────────
  // OFFICE EMPLOYEES — Zac's team
  // ─────────────────────────────────────────────
  console.log('\n📋 Creating Office Employees (Zac\'s team)...')

  const officeTeam = [
    { email: 'AdamVetere@UsedCardboardBoxes.com', fullName: 'Adam Vetere', dept: 'B2B Sales' },
    { email: 'JonathanArias@UsedCardboardBoxes.com', fullName: 'Johnny Arias', dept: 'B2B Sourcing' },
    { email: 'ChristopherGerard@UsedCardboardBoxes.com', fullName: 'Chris Gerard', dept: 'B2B Sourcing' },
    { email: 'CatalinaMussio@usedcardboardboxes.com', fullName: 'Catalina Mussio', dept: 'B2B Sourcing' },
    { email: 'JestleGaylo@UsedCardboardBoxes.com', fullName: 'Jestle Gaylo', dept: 'B2B Sourcing' },
    { email: 'PaulBuenaventura@UsedCardboardBoxes.com', fullName: 'Paul Buenaventura', dept: 'B2B Sourcing' },
    { email: 'WillSerenko@UsedCardboardBoxes.com', fullName: 'Will Serenko', dept: 'B2B Sourcing' },
    { email: 'AdamBelleville@UsedCardboardBoxes.com', fullName: 'Adam Belleville', dept: 'B2B Sourcing' },
    { email: 'CharlesFrancia@UsedCardboardBoxes.com', fullName: 'Charles Francia', dept: 'B2B Sourcing' },
    { email: 'CarlaDeCastro@UsedCardboardBoxes.com', fullName: 'Carla De Castro', dept: 'B2B Sourcing' },
    { email: 'BlakeNuckols@UsedCardboardBoxes.com', fullName: 'Blake Nuckols', dept: 'B2B Sourcing' },
    { email: 'JonathonJones@UsedCardboardBoxes.com', fullName: 'Jonathon Jones', dept: 'B2B Sourcing' },
    { email: 'MarcSalido@usedcardboardboxes.com', fullName: 'Marc Salido', dept: 'B2B Sourcing' },
    { email: 'AaronDinglasan@UsedCardboardBoxes.com', fullName: 'Aaron Dinglasan', dept: 'B2B Sourcing' },
    { email: 'ChristySchalk@UsedCardboardBoxes.com', fullName: 'Christy Schalk', dept: 'B2B Sales' },
  ]

  for (const o of officeTeam) {
    await createUser({
      email: o.email,
      password: DEFAULT_PASSWORD,
      fullName: o.fullName,
      role: 'employee',
      managerId: zacId,
      department: o.dept,
    })
  }

  // ─────────────────────────────────────────────
  // PRODUCTION WORKERS — Proxy only (no direct login)
  // Email: firstname.lastname@ucbproduction.internal
  // ─────────────────────────────────────────────

  // Helper to make a proxy email
  function proxyEmail(name) {
    return `${slugName(name)}@ucbproduction.internal`
  }

  // ── HVP workers under Shane Janicki ──────────
  console.log('\n📋 Creating HVP Production Workers (under Shane Janicki)...')
  const hvpWorkers = [
    'Donald Wilson',
    'Maurice Gaines',
    'Alexander Campbell',
    'Kondwani Martin',
    'Robert Smith',
    'Dawnta Harris',
    'Kareen Moore',
    'Tywon Harris',
    'Kenneth Henderson',
    'William Brown',
    'Curtis Brogdon',
    'Candice Bailey',
    'Gary Rivers',
    'Larry Bryant',
    'Mark Jones',
    'Joseph Lockwood',
    'Kevin Cartwell',
    'Terrance Nelson',
    'Darnell Fletcher',
  ]
  for (const name of hvpWorkers) {
    await createUser({
      email: proxyEmail(name),
      password: crypto.randomUUID(),
      fullName: name,
      role: 'employee',
      managerId: shaneId,
      department: 'HVP - Hunt Valley Production',
    })
  }

  // ── MLC workers under Juanita Ford ───────────
  console.log('\n📋 Creating MLC Production Workers (under Juanita Ford)...')
  const mlcWorkers = ['Ariana Crippens', 'Damany Tate']
  for (const name of mlcWorkers) {
    await createUser({
      email: proxyEmail(name),
      password: crypto.randomUUID(),
      fullName: name,
      role: 'employee',
      managerId: juanitaId,
      department: 'MLC - McCormick',
    })
  }

  // ── ML workers under Felix Diaz ──────────────
  console.log('\n📋 Creating Milwaukee Production Workers (under Felix Diaz)...')
  const mlWorkers = [
    'Johnny Woods',
    'Norberto Rodriguez',
    'Ronnelle Lewis',
    'Kelvin Santigo',
    'Daniel Rogers',
    'Justin McCollegan',
    'Rashad Alexander',
    'Julian Lopez',
    'Lamonrion Weathers',
  ]
  for (const name of mlWorkers) {
    await createUser({
      email: proxyEmail(name),
      password: crypto.randomUUID(),
      fullName: name,
      role: 'employee',
      managerId: felixId,
      department: 'ML - Milwaukee Production',
    })
  }

  // ── HA workers under Anthony Sparks ──────────
  console.log('\n📋 Creating Hannibal (HA) Production Workers (under Anthony Sparks)...')
  const haWorkers = [
    'Chris Brown',
    'Timothy Luckett',
    'Michelle Hoskins',
    'Robert Wisdom',
    'Gary Smith',
    'Jade Talley',
    'Christina Smith',
    'Tannor Smith',
    'Brandon Wolter',
    'Jay Underhill',
    'Richard Carter',
    'Jason Saxbury',
    'Ethan Birkhead',
    'Jason McCloud',
    'Jesse Thomas',
  ]
  for (const name of haWorkers) {
    await createUser({
      email: proxyEmail(name),
      password: crypto.randomUUID(),
      fullName: name,
      role: 'employee',
      managerId: anthonyId,
      department: 'HA - Hannibal',
    })
  }

  // ── HV workers under Bradley Alexander ───────
  console.log('\n📋 Creating Hunt Valley (HV) Production Workers (under Bradley Alexander)...')
  const hvWorkers = [
    'Nicholas Finnigan',
    'Samuel Thomas',
    'Carolina Sinclair',
    'Alex Arnold',
    'Quintin Holland',
    'Remington Pack',
  ]
  for (const name of hvWorkers) {
    await createUser({
      email: proxyEmail(name),
      password: crypto.randomUUID(),
      fullName: name,
      role: 'employee',
      managerId: bradleyId,
      department: 'HV - Hunt Valley',
    })
  }

  // ─────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────
  console.log('\n✅ User seed complete!\n')
  console.log('Login credentials for managers and office staff:')
  console.log(`  Password: ${DEFAULT_PASSWORD}`)
  console.log('\nProxy production workers cannot log in directly.')
  console.log('Managers use "Start Training" in the app to proxy-login for them.\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
