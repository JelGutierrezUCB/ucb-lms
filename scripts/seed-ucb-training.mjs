/**
 * UCB Training Module Seeder
 *
 * Run this script AFTER setting up your .env.local with Supabase credentials.
 * Usage: node scripts/seed-ucb-training.mjs
 *
 * This creates all training modules extracted from the UCB Production Training Manual.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env vars from .env.local
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
let supabaseUrl, serviceRoleKey
try {
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    const val = rest.join('=').trim()
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceRoleKey = val
  }
} catch {
  console.error('Could not read .env.local. Make sure it exists with your Supabase credentials.')
  process.exit(1)
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ─────────────────────────────────────────────────────────────
// Training Module Definitions
// ─────────────────────────────────────────────────────────────

const MODULES = [

  // ──────────────────────────────────────────────────────────
  // MODULE 1: Company Overview & General Safety (for everyone)
  // ──────────────────────────────────────────────────────────
  {
    title: 'UCB Company Overview & Safety',
    description: 'An introduction to UsedCardboardBoxes (UCB), our mission, facilities, team structure, and the foundational safety rules every team member must know — including LOTO procedures.',
    category: 'warehouse',
    thumbnail_color: '#15803d',
    estimated_minutes: 35,
    is_published: true,
    sections: [
      {
        title: 'Welcome to UsedCardboardBoxes (UCB)',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Who We Are</h2>
<p>At <strong>UsedCardboardBoxes (UCB)</strong>, we are committed to sustainability and efficient resource management. We focus on providing sustainable solutions, including used cardboard, pallets, and other recyclable materials — ensuring that waste is minimized and resources are reused effectively.</p>
<h2>Our Mission</h2>
<p>Our operations rely on a strong production team to meet these goals daily. Every team member plays a vital role in advancing UCB's commitment to environmental responsibility.</p>
<h2>The Production Department</h2>
<p>The Production Department plays a key role in supporting the company's commitment to sustainability. This department handles the <strong>sorting, processing, and movement of materials</strong> within our facilities, ensuring that production goals are met efficiently while maintaining high safety standards.</p>
<p>Team members work collaboratively to ensure that products move smoothly through the warehouse — from arrival to shipment.</p>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'q1_1',
                  question: 'What is the primary focus of UsedCardboardBoxes (UCB)?',
                  options: [
                    'Manufacturing new cardboard boxes',
                    'Providing sustainable solutions including used cardboard and recyclable materials',
                    'Retail sales of packaging supplies',
                    'Transporting goods for other companies'
                  ],
                  correct_index: 1,
                  explanation: 'UCB focuses on sustainability and efficient resource management by providing used cardboard, pallets, and other recyclable materials to minimize waste.'
                },
                {
                  id: 'q1_2',
                  question: 'What does the Production Department primarily handle?',
                  options: [
                    'Customer service and order management',
                    'Accounting and payroll',
                    'Sorting, processing, and movement of materials within facilities',
                    'Marketing and advertising'
                  ],
                  correct_index: 2,
                  explanation: 'The Production Department handles sorting, processing, and movement of materials to ensure products move smoothly from arrival to shipment.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Our Facilities & Locations',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Two Types of Facilities</h2>
<p>UCB operates two distinct types of facilities, each with a different focus:</p>
<h3>Production Facilities</h3>
<p>Production facilities focus on <strong>processing and sorting products</strong> to meet specific production quotas. Sorted products are prepared for shipment to customers. These facilities operate with efficiency targets and structured workflows to maximize output and maintain quality standards.</p>
<p><strong>Production Facility Locations:</strong></p>
<ul>
<li>Hannibal (HA)</li>
<li>Milwaukee (ML)</li>
<li>Hunt Valley (HV)</li>
</ul>
<h3>Non-Production Facilities</h3>
<p>Non-production facilities handle <strong>waste management and separation of recyclables</strong> without the pressure of production quotas. Their primary goal is proper disposal, recycling, and sustainability efforts.</p>
<p><strong>Non-Production Facility Locations:</strong></p>
<ul>
<li>Sparrows Point (MLC)</li>
<li>McCormick Spice (HVP)</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'q2_1',
                  question: 'Which of the following is a Production Facility location?',
                  options: ['Sparrows Point (MLC)', 'McCormick Spice (HVP)', 'Milwaukee (ML)', 'Baltimore (BAL)'],
                  correct_index: 2,
                  explanation: 'Milwaukee (ML) is one of three production facilities. The other two are Hannibal (HA) and Hunt Valley (HV).'
                },
                {
                  id: 'q2_2',
                  question: 'What is the key difference between Production and Non-Production facilities?',
                  options: [
                    'Production facilities are larger',
                    'Production facilities meet specific production quotas while non-production facilities focus on waste management and recycling',
                    'Non-production facilities sort more product',
                    'There is no difference — they do the same work'
                  ],
                  correct_index: 1,
                  explanation: 'Production facilities have efficiency targets and prepare products for customer shipment. Non-production facilities focus on proper disposal and recycling without production quotas.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Production Team Roles',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Roles in the Production Department</h2>
<p>The Production Department consists of various roles, each contributing to the overall success of the operation. All team members work together to meet daily production targets and maintain a safe, clean work environment.</p>
<ol>
<li><strong>Shift Lead</strong> — Oversees facility operations, safety, and team management</li>
<li><strong>Forklift Operators</strong> — Move materials throughout the warehouse</li>
<li><strong>Tote Sorters</strong> — Sort and grade Gaylord totes</li>
<li><strong>Shipping Box Sorters</strong> — Sort and inspect shipping boxes</li>
<li><strong>Lid Sorters</strong> — Inspect and sort lids from Gaylord totes</li>
<li><strong>Bander</strong> — Secures finished products using banding equipment</li>
<li><strong>Baler Operator (Horizontal)</strong> — Operates horizontal baler for compacting materials</li>
<li><strong>Baler Operator (Vertical)</strong> — Operates vertical baler for compacting recyclables</li>
<li><strong>Slitter Operator</strong> — Operates slitting machine to cut cardboard</li>
<li><strong>Slotter Operator</strong> — Operates eccentric slotter machine</li>
<li><strong>Band Saw Operator</strong> — Resizes totes using a band saw (2-person operation)</li>
<li><strong>Miter Saw Operator</strong> — Cuts materials accurately using a miter saw</li>
<li><strong>Kit Room</strong> — Assembles and packages materials into kits</li>
</ol>
<p>Each role has specific responsibilities, but all team members work together as one team.</p>`
            }
          }
        ]
      },
      {
        title: 'General Workplace Safety',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Preventing Falls and Slips</h2>
<ul>
<li>Open loading dock doors and areas where employees could fall four feet or more <strong>must be secured with chains, ropes, or other barriers</strong></li>
<li>Floors and aisles should remain <strong>clear of clutter, electrical cords, hoses, spills</strong>, and other hazards</li>
</ul>
<h2>Work Environment & Ergonomics</h2>
<ul>
<li>Adequate time must be allocated to complete tasks safely</li>
<li>Take <strong>regular breaks</strong> during physical tasks to prevent fatigue</li>
<li>New employees must receive general ergonomics and task-specific training</li>
<li>The warehouse must be well-ventilated</li>
<li>Be trained to manage <strong>heat stress</strong> in hot/humid environments</li>
</ul>
<h2>Materials Handling Safety</h2>
<ul>
<li>Aisles, loading docks, and passageways must have <strong>clear and safe markings</strong></li>
<li>Loose or unboxed materials must be <strong>stacked properly</strong> to prevent falling hazards</li>
<li>Storage areas must be free of excessive materials that could cause tripping, fires, or pest infestations</li>
</ul>
<h2>Proper Lifting Techniques</h2>
<ul>
<li>Always use <strong>proper lifting techniques</strong> to prevent injuries</li>
<li>Guardrails and covers must protect personnel from floor openings and similar hazards</li>
</ul>
<h2>Chemical Safety</h2>
<ul>
<li>Hazardous material containers must be labeled with chemical identity, manufacturer details, and hazard warnings</li>
<li>A written hazard communication program (MSDS) must be in place</li>
<li>Always wear required <strong>Personal Protective Equipment (PPE)</strong> when handling hazardous chemicals</li>
<li>Chemicals must be stored per manufacturer recommendations and fire safety regulations</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'q4_1',
                  question: 'What must be secured at open loading dock doors where employees could fall four feet or more?',
                  options: [
                    'Warning cones only',
                    'Chains, ropes, or other barriers',
                    'Nothing — employees are responsible for their own safety',
                    'A supervisor must stand there at all times'
                  ],
                  correct_index: 1,
                  explanation: 'OSHA requires that open loading dock doors with a fall risk of four feet or more must be secured with chains, ropes, or other physical barriers.'
                },
                {
                  id: 'q4_2',
                  question: 'What should you do when handling hazardous chemicals?',
                  options: [
                    'Work quickly to minimize exposure time',
                    'Wear required Personal Protective Equipment (PPE)',
                    'Ask a coworker to handle it instead',
                    'Only handle chemicals outdoors'
                  ],
                  correct_index: 1,
                  explanation: 'Always wear required PPE when handling hazardous chemicals. This is a requirement, not optional.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Lockout / Tagout (LOTO)',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>What is LOTO?</h2>
<p>As OSHA states, the purpose of <strong>Lockout/Tagout (LOTO)</strong> is to prevent the unexpected energization or startup of machines or equipment — or the release of stored energy — that could cause injury to employees.</p>
<p><em>LOTO is more than just putting a yellow lock on the main electrical disconnect. Knowing HOW to lock out energy sources is critical.</em></p>
<h2>The 7 Steps for LOTO Shutdown</h2>
<ol>
<li><strong>NOTIFY</strong> — Notify all affected employees that you are going to be conducting a lockout/tagout</li>
<li><strong>PREPARE</strong> — Know all types of energy involved, hazards presented, and how to control the energy</li>
<li><strong>SHUTDOWN</strong> — Turn off the machine or equipment</li>
<li><strong>ISOLATE</strong> — Isolate the machine from its energy source(s) (e.g., turn off the main circuit breaker)</li>
<li><strong>LOCKOUT</strong> — Apply your lock; ensure it holds the isolating device in the "off" or "safe" position</li>
<li><strong>RELEASE</strong> — Release stored energy. Relieve, disconnect, restrain, or block all energy sources: electrical, mechanical, hydraulic, compressed air, etc.</li>
<li><strong>VERIFY</strong> — Try the on/off switch to confirm the machine won't start. Return switch to "off" position</li>
</ol>
<h2>The 3 Steps for LOTO Restart</h2>
<ol>
<li><strong>INSPECT</strong> — Ensure all tools removed, machine reassembled, guards reinstalled</li>
<li><strong>NOTIFY</strong> — All employees safely positioned; all affected employees notified of restart</li>
<li><strong>REMOVE</strong> — Remove lockout devices. <strong>Only the person who placed the lock may remove it.</strong></li>
</ol>
<h2>Types of Energy Covered by LOTO</h2>
<ul>
<li>Electrical energy</li>
<li>Pneumatic energy (compressed air)</li>
<li>Steam</li>
<li>Natural gas</li>
<li>Water</li>
<li>Hydraulic energy</li>
<li>Gravity</li>
<li>Thermal energy</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 100,
              questions: [
                {
                  id: 'q5_1',
                  question: 'What is the purpose of Lockout/Tagout (LOTO)?',
                  options: [
                    'To mark equipment that needs maintenance',
                    'To prevent unexpected energization or startup of machines that could injure employees',
                    'To track who used which machine',
                    'To identify broken equipment'
                  ],
                  correct_index: 1,
                  explanation: 'LOTO prevents unexpected energization or startup of machines and equipment, or release of stored energy that could cause injury.'
                },
                {
                  id: 'q5_2',
                  question: 'How many steps are in the LOTO Shutdown procedure?',
                  options: ['3', '5', '7', '10'],
                  correct_index: 2,
                  explanation: 'There are 7 steps: Notify, Prepare, Shutdown, Isolate, Lockout, Release, Verify.'
                },
                {
                  id: 'q5_3',
                  question: 'Who is allowed to remove the LOTO lock?',
                  options: [
                    'Any supervisor',
                    'Any certified employee',
                    'Only the person who placed the lock',
                    'The shift lead'
                  ],
                  correct_index: 2,
                  explanation: 'Only the person who placed the lock may remove it. This is a critical safety rule — no exceptions.'
                },
                {
                  id: 'q5_4',
                  question: 'What should you do FIRST before performing LOTO shutdown?',
                  options: [
                    'Turn off the machine',
                    'Apply your lock',
                    'Notify all affected employees',
                    'Release stored energy'
                  ],
                  correct_index: 2,
                  explanation: 'The first step is to NOTIFY all affected employees that you are conducting a lockout/tagout. This ensures everyone is aware and can stay safe.'
                }
              ]
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 2: Tote Sorter Training
  // ──────────────────────────────────────────────────────────
  {
    title: 'Tote Sorter Training',
    description: 'Complete training for Gaylord tote sorters covering grading criteria (Grade A, B, C), the daily sorting process, labeling requirements, and quality standards.',
    category: 'warehouse',
    thumbnail_color: '#b45309',
    estimated_minutes: 25,
    is_published: true,
    sections: [
      {
        title: 'Role Overview & Daily Responsibilities',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>What Does a Tote Sorter Do?</h2>
<p>The Tote Sorter is responsible for <strong>sorting and grading Gaylord totes</strong> based on established sorting criteria. This role involves inspecting totes, removing debris, labeling sorted totes, and maintaining accurate records.</p>
<p>The goal is to ensure that totes meet quality standards for reuse and to identify those that require recycling.</p>
<h2>Daily Responsibilities</h2>
<ul>
<li>Clock in/out using the online system</li>
<li>Follow Lockout/Tagout (LOTO) procedures for safety</li>
<li>Complete the sort report with initials, date, and start time <strong>before beginning sorting</strong></li>
<li>Inspect each tote for quality and assign it to the appropriate grade (Grade A, Grade B, or Recycle/Grade C)</li>
<li>Remove any foreign objects, food particles, or residues from totes</li>
<li>Ensure all labels and barcodes are properly <strong>marked out with a black marker</strong> to prevent accidental scanning</li>
<li>Stack sorted totes according to grading and size requirements</li>
<li>Label completed bundles with: size, quantity, date, and your initials</li>
<li>Keep the sorting area clean and organized</li>
<li>Dispose of debris and damaged totes in designated recycling areas</li>
<li>Maintain safety standards and follow proper lifting techniques</li>
</ul>`
            }
          }
        ]
      },
      {
        title: 'Grading Criteria: Grade A, B, and C',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Grade A Criteria — A tote must have ALL of the following:</h2>
<ul>
<li><strong>No penetrating holes</strong> on the tote body</li>
<li><strong>No torn outer layer</strong> of sidewall exposing flute larger than 5 inches</li>
<li><strong>No missing flaps</strong>, tears or cuts from edges of flaps longer than 5 inches</li>
<li><strong>No insect or rodent evidence</strong>, and no heavy chemical, water, or liquid damage/staining inside</li>
<li><em>Note: Minor spots (only a few) can still pass as a good tote</em></li>
<li><strong>No food product remains</strong> inside; no residue that cannot be removed through light cleaning</li>
<li><strong>No fatigued totes</strong></li>
<li>Totes NOT previously used for waste (no Trash or Offal sticker)</li>
<li><strong>All allergen labels must be marked out</strong> with an X, and a line drawn through all barcode labels using a black marker</li>
</ul>
<h2>Grade B Criteria</h2>
<p>If <strong>any of the above disqualifies</strong> a tote from Grade A status, it is considered <strong>Grade B</strong>.</p>
<h2>Grade C / Recycle</h2>
<p>If a tote is <strong>badly damaged or missing pieces</strong>, it will be categorized as a <strong>recycled (Grade C) tote</strong>.</p>
<p><em>Remember: When in doubt about a tote's grade, ask your Shift Lead.</em></p>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qt1_1',
                  question: 'A tote has a torn outer sidewall that exposes fluting 3 inches wide. What grade should it receive?',
                  options: ['Grade A', 'Grade B', 'Grade C / Recycle', 'It needs manager approval'],
                  correct_index: 0,
                  explanation: 'Grade A requires no torn outer layer exposing flute LARGER THAN 5 inches. A 3-inch tear is within Grade A standards.'
                },
                {
                  id: 'qt1_2',
                  question: 'What must you do with all allergen labels and barcode labels on a tote?',
                  options: [
                    'Remove the labels completely',
                    'Mark allergen labels with X and draw a line through barcodes with a black marker',
                    'Cover them with tape',
                    'Nothing — they can remain visible'
                  ],
                  correct_index: 1,
                  explanation: 'All allergen labels must be marked with an X and all barcode labels must have a line drawn through them using a black marker to prevent accidental scanning.'
                },
                {
                  id: 'qt1_3',
                  question: 'You find a tote with a few minor spots of liquid damage inside, but otherwise in good condition. What grade should it receive?',
                  options: ['Grade C / Recycle', 'Grade B', 'Grade A — minor spots are acceptable', 'It cannot be graded'],
                  correct_index: 2,
                  explanation: 'The criteria states: "if the evidence is minor (only a few spots), this can still pass as a good tote." Minor spots do not disqualify a tote from Grade A.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'The Sorting Process',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Step-by-Step Sorting Process</h2>
<ol>
<li>Totes will be staged in a sort area. Your Shift Lead will assign you an area of totes to sort</li>
<li>Fill out the <strong>sort report</strong> with your initials, date, and time started</li>
<li>Inspect each tote using the grading criteria (Grade A, B, or Recycle)</li>
<li>Remove any foreign objects, food particles, or residue from totes</li>
<li>Mark out all allergen labels with X and draw a line through all barcode labels</li>
<li>Stack sorted totes according to their grade and size</li>
<li>Label completed bundles with size, quantity, date, and your initials</li>
<li>Dispose of debris and damaged totes in designated recycling areas</li>
</ol>
<h2>Keeping Your Area Clean</h2>
<p>A clean sort area is a safe sort area. Keep your workspace organized throughout your shift. Debris and rejected materials must be disposed of properly and immediately — do not let them accumulate.</p>
<h2>At the End of Your Shift</h2>
<ul>
<li>Ensure all completed bundles are labeled and accounted for</li>
<li>Turn in your sort report to the office</li>
<li>Clean your sorting area</li>
<li>Communicate with the Forklift Operator to move finished product</li>
</ul>`
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 3: Forklift Operator Training
  // ──────────────────────────────────────────────────────────
  {
    title: 'Forklift Operator Training',
    description: 'Complete training for UCB Forklift Operators covering pre-shift inspection, unloading and loading trailers, supporting production teams, documentation requirements, and safe operating practices.',
    category: 'warehouse',
    thumbnail_color: '#b45309',
    estimated_minutes: 30,
    is_published: true,
    sections: [
      {
        title: 'Role Overview & Daily Responsibilities',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>What Does a Forklift Operator Do?</h2>
<p>The Forklift Operator ensures the <strong>efficient movement of materials</strong> within the warehouse. This includes loading and unloading trailers, moving products to and from production workers, and ensuring finished goods are properly stored and ready for shipment.</p>
<h2>Daily Responsibilities</h2>
<ul>
<li>Clock in/out using the online system</li>
<li>Follow Lockout/Tagout (LOTO) procedures for safety</li>
<li><strong>Forklift Inspection:</strong> Conduct and fill out a pre-shift inspection to ensure the forklift is in good working order</li>
<li><strong>Loading/Unloading:</strong> Unload product from trailers and place in staging areas; load finished product onto trailers</li>
<li><strong>Supporting Production:</strong> Position unsorted products for production workers and remove finished products as required</li>
<li><strong>End-of-Day Setup:</strong> Store finished goods and set up materials for the next shift</li>
<li><strong>Warehouse Maintenance:</strong> Keep the warehouse clean, organized, and compliant with safety standards</li>
<li><strong>Communication:</strong> Inform Office personnel when a trailer is empty and communicate where product was staged</li>
</ul>
<p><strong>Weekly Maintenance:</strong> Blow out radiators and air filters on forklifts using an air compressor.</p>`
            }
          }
        ]
      },
      {
        title: 'Unloading a Trailer — Step by Step',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>How to Unload a Trailer</h2>
<ol>
<li>The Manager will communicate dock moves with you and instruct you on which trailer to unload</li>
<li>Verify the <strong>wheel chocks are placed in front of the trailer wheels</strong> and install a glad hand lock when applicable</li>
<li>Put the <strong>dock plate down</strong> and start unloading the trailer, moving product to the sort area</li>
<li><strong>Documentation:</strong> Fill out the Pre-Shift Debrief report with:
<ul>
<li>Company Name</li>
<li>UCB Transaction #</li>
<li>Trailer Number</li>
<li>Dock Number</li>
<li>Area location where product was placed</li>
</ul>
</li>
<li>When the trailer is empty: remove the dock plate, remove the glad hand lock, and close the dock door</li>
<li><strong>Communication:</strong> Inform Office personnel that the trailer is empty and ready to be moved, and tell them where the product was staged</li>
</ol>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qf1_1',
                  question: 'Before unloading a trailer, what must you verify?',
                  options: [
                    'The trailer is the right color',
                    'Wheel chocks are placed in front of the trailer wheels',
                    'The dock door is open',
                    'The manager is watching'
                  ],
                  correct_index: 1,
                  explanation: 'Before unloading, you must verify that wheel chocks are placed in front of the trailer wheels to prevent it from moving during unloading.'
                },
                {
                  id: 'qf1_2',
                  question: 'After completing unloading, who do you notify and what do you tell them?',
                  options: [
                    'The Shift Lead — tell them you are done for the day',
                    'Office personnel — tell them the trailer is empty and where the product was staged',
                    'The truck driver — tell them they can leave',
                    'No one — just move to the next task'
                  ],
                  correct_index: 1,
                  explanation: 'After unloading, you must communicate with Office personnel to inform them the trailer is empty and ready to be moved, and tell them where the product was staged.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Loading a Trailer — Step by Step',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>How to Load a Trailer</h2>
<ol>
<li>The Manager/Office will communicate with you by radio when a trailer is to be loaded and which dock door it will be loaded from</li>
<li>Come to the office and receive the <strong>Pick List</strong>. Verify:
<ul>
<li>Company name</li>
<li>UCB transaction number</li>
<li>Product and quantity being loaded</li>
</ul>
</li>
<li>Open the dock door and lower the dock plate</li>
<li><strong>Inspect the trailer for damage.</strong> Report any holes or damage to the office before loading</li>
<li>Sweep out the trailer before loading</li>
<li>Fill out the <strong>Pre-Shift Debrief report</strong></li>
<li><strong>Special note for General Mills orders:</strong> The GMI Tote Processing Center Trailer Inspection Record must be filled out prior to loading, noting if accepted or rejected</li>
<li>Load product onto the trailer, <strong>documenting each bundle</strong> on the pick list and updating row sheets as product is removed from inventory</li>
<li>After loading: Secure the back of the trailer with load straps, remove dock plate, close dock door</li>
<li>Take the pick list to the office. Office staff will verify information and create a BOL (3 copies)</li>
<li>Fill out the <strong>Shipper section of the BOL</strong> with your printed name, signature, date, and time</li>
<li>Take the BOL to the truck driver and have them sign all 3 copies. Keep 1 copy, give the driver 2 copies</li>
</ol>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qf2_1',
                  question: 'What should you do if you find damage to a trailer before loading?',
                  options: [
                    'Load the trailer anyway and note it later',
                    'Report any holes or damage to the office BEFORE loading',
                    'Refuse to load and leave',
                    'Try to repair the damage yourself'
                  ],
                  correct_index: 1,
                  explanation: 'All trailers must be inspected for damage and any holes or damage must be reported to the office PRIOR to loading.'
                },
                {
                  id: 'qf2_2',
                  question: 'When is the GMI Tote Processing Center Trailer Inspection Record required?',
                  options: [
                    'Every trailer load',
                    'Only on Mondays',
                    'For General Mills (GMI) orders only',
                    'When the trailer is damaged'
                  ],
                  correct_index: 2,
                  explanation: 'The GMI Tote Processing Center Trailer Inspection Record must be filled out prior to loading for General Mills orders specifically, noting if the trailer was accepted or rejected.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Supporting Production Teams',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Your Goal: Keep Production Flowing</h2>
<p>Your primary goal as a Forklift Operator is to <strong>keep up with the flow of the product being produced</strong>. Do not let sort areas get backed up — this slows down the entire production team.</p>
<h2>Working with the Production Team</h2>
<ul>
<li><strong>Sort Area:</strong> Once a production employee completes a pallet of product, they label it. You then remove it from the sort area and move it to the staging area to be banded</li>
<li><strong>Daily Tracking Sheet:</strong> Document each finished pallet by filling out the Daily Tracking Sheet with your name, who sorted the product, the size, and the count. Turn this in to the office at end of shift</li>
<li><strong>Staging Area:</strong> Move banded product from the staging area to the warehouse finished goods area</li>
<li><strong>Finished Goods:</strong> Update the Row Sheet as product is moved in or out of finished goods rows</li>
</ul>
<h2>Row Sheets</h2>
<p>Row Sheets are placed at the front of each finished goods row. You must update the Row Sheet whenever product is put into or pulled out of a row. Accurate Row Sheets are essential for inventory management.</p>`
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 4: Shipping Box Sorter Training
  // ──────────────────────────────────────────────────────────
  {
    title: 'Shipping Box Sorter Training',
    description: 'Training for Shipping Box Sorters covering quality inspection criteria, the daily sorting process, documentation, and standards for preparing boxes for resale.',
    category: 'warehouse',
    thumbnail_color: '#0891b2',
    estimated_minutes: 20,
    is_published: true,
    sections: [
      {
        title: 'Role Overview & Daily Responsibilities',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>What Does a Shipping Box Sorter Do?</h2>
<p>The Shipping Box Sorter is responsible for <strong>sorting, inspecting, and organizing shipping boxes</strong> by quality and size. The goal is to ensure only boxes meeting our quality standards are prepared for resale to customers.</p>
<h2>Daily Responsibilities</h2>
<ul>
<li>Clock in/out using the online system</li>
<li>Pick up your assigned sort report from the office, along with a blank daily production sheet</li>
<li>Proceed to the sort area documented on your sort report</li>
<li>Sort through boxes — ensure all flaps are intact and no holes are present</li>
<li>Look for any partial completed pallets in inventory and complete them if possible</li>
<li>Ensure quality sorted boxes are stacked in the exact same way with seam centered and facing down</li>
<li>Stack boxes upside down on the pallet (main sticker always in the same position)</li>
<li>Complete all documentation and turn in at end of shift</li>
</ul>`
            }
          }
        ]
      },
      {
        title: 'Box Quality Inspection',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Inspecting a Box for Quality</h2>
<p>While assessing the integrity of a box may be an art more than a science, here are the key things to look for:</p>
<ul>
<li>Check that <strong>all flaps are intact</strong> — no tears, cuts, or missing flaps</li>
<li>Verify there are <strong>no holes</strong> in the box walls or bottom</li>
<li>Inspect for <strong>water damage</strong> — waterlogged boxes cannot be resold</li>
<li>Check for <strong>structural integrity</strong> — the box should hold its shape when assembled</li>
</ul>
<h2>Quality Stacking Standards</h2>
<ul>
<li>All quality sorted boxes must be stacked the <strong>exact same way</strong></li>
<li>Seam centered and <strong>facing down</strong></li>
<li>Main sticker always in the same spot on every box</li>
<li>Boxes are stacked on the pallet <strong>upside down</strong></li>
</ul>
<h2>Berry Quality Program</h2>
<p>For Berry Closed Loop Packaging orders, refer to the Berry Closed Loop Packaging Program Document for specific quality sorting details. At the end of your sort, put your initials, date, and time on the sort report.</p>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qbs1_1',
                  question: 'How should quality-sorted boxes be stacked on a pallet?',
                  options: [
                    'Right-side up with the opening facing up',
                    'Upside down with the seam centered and facing down, main sticker in same position',
                    'On their side to save space',
                    'Any way that fits the most boxes'
                  ],
                  correct_index: 1,
                  explanation: 'Quality sorted boxes must be stacked upside down with the seam centered and facing down, and the main sticker always in the same position. Consistency is required.'
                },
                {
                  id: 'qbs1_2',
                  question: 'What should you do if you find a partial completed pallet in inventory?',
                  options: [
                    'Leave it for the next shift',
                    'Report it to the Shift Lead',
                    'Complete it if possible',
                    'Move it to recycling'
                  ],
                  correct_index: 2,
                  explanation: 'When you find partial completed pallets in inventory, complete them if possible. This maximizes efficiency and keeps the warehouse organized.'
                }
              ]
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 5: Baler Operator Training (Horizontal & Vertical)
  // ──────────────────────────────────────────────────────────
  {
    title: 'Baler Operator Training',
    description: 'Essential training for Horizontal and Vertical Baler Operators covering machine controls, safe operation procedures, bale tying, and maintenance requirements. LOTO procedures are emphasized throughout.',
    category: 'warehouse',
    thumbnail_color: '#7c3aed',
    estimated_minutes: 35,
    is_published: true,
    sections: [
      {
        title: 'Horizontal Baler — Role & Safety Overview',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Horizontal Baler Operator Role</h2>
<p>The Horizontal Baler Operator is responsible for <strong>operating and overseeing a horizontal baler system</strong> that compacts large volumes of recyclable materials into bales for efficient storage and transport.</p>
<h2>Pre-Shift Safety Checks</h2>
<p>Before operating the horizontal baler, ensure that:</p>
<ul>
<li>All parts, component equipment, and safeguards are in <strong>safe operating condition</strong></li>
<li>All adjustments are made per manufacturer's recommended procedures</li>
<li>All protective guards are in place</li>
<li>The work area is clear of hazards</li>
</ul>
<h2>Key Control Panel Functions</h2>
<ul>
<li><strong>START UP ALARM:</strong> When the baler is turned on, a buzzer sounds and red light flashes for 20 seconds as a warning</li>
<li><strong>BALER PHOTO EYE:</strong> When set to ON and system is in AUTO, the photo eye activates the baler automatically</li>
<li><strong>SHORT STROKE selector:</strong> Adjusts the platen stroke depth</li>
<li><strong>KEY SWITCH:</strong> Controls HAND or AUTO operation mode</li>
<li><strong>BALE TIE OFF LIGHT:</strong> Illuminates when the bale is ready to be tied and ejected</li>
</ul>`
            }
          }
        ]
      },
      {
        title: 'Horizontal Baler — Operation & Bale Tying',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Starting the Horizontal Baler</h2>
<ol>
<li>Turn the BALER power disconnect switch to the ON position</li>
<li>Set the selector for SHORT STROKE to OFF or ON as required</li>
<li>Set the selector for BALER PHOTO EYE to OFF</li>
<li>Turn the key switch to the HAND position for manual operation</li>
</ol>
<h2>Tying a Bale</h2>
<ol>
<li>Turn the key switch to the HAND position. Turn the BALER PHOTO EYE SWITCH to OFF</li>
<li>From the top of the baler, thread the end of the wire through the corresponding slot</li>
<li>Push the wire until it comes out the bottom of the slot in the door</li>
<li>Pull the wires through to allow enough slack for securing the two ends together</li>
</ol>
<h2>Ejecting a Bale</h2>
<p>The bale is ready to be ejected when:</p>
<ul>
<li>The machine has stopped</li>
<li>The <strong>BALE TIE OFF LIGHT is illuminated</strong></li>
<li>The bale has been tied following the instructions above</li>
</ul>
<h2>Cleaning the Baler (LOTO Required)</h2>
<ul>
<li>Always observe proper <strong>Lock Out/Tag Out (LOTO)</strong> procedures BEFORE cleaning the baler</li>
<li>After the bale has been removed, clear the inside of the baler of all debris</li>
<li>Never clean the baler while it is powered on</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qba1_1',
                  question: 'When is the bale ready to be ejected from the horizontal baler?',
                  options: [
                    'When the baler makes a loud noise',
                    'When the BALE TIE OFF LIGHT is illuminated and the bale has been tied',
                    'After 30 minutes of operation',
                    'When the baler auto-stops'
                  ],
                  correct_index: 1,
                  explanation: 'The bale is ready to be ejected after the machine stops with the BALE TIE OFF LIGHT illuminated AND the bale has been properly tied.'
                },
                {
                  id: 'qba1_2',
                  question: 'What must you do BEFORE cleaning the horizontal baler?',
                  options: [
                    'Turn it to AUTO mode',
                    'Ask the Shift Lead for permission',
                    'Observe proper Lockout/Tagout (LOTO) procedures',
                    'Wait for it to cool down for 5 minutes'
                  ],
                  correct_index: 2,
                  explanation: 'LOTO procedures MUST be observed before cleaning the baler. Never clean the baler while it is powered on.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Vertical Baler — Operation & Safety',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Vertical Baler Operator Role</h2>
<p>The Vertical Baler Operator is responsible for <strong>operating and maintaining a vertical baler machine</strong> to compact recyclable materials such as cardboard and paper into dense bales.</p>
<h2>Critical Safety Rules</h2>
<ul>
<li><strong>DANGER: Never place any part of body inside the bale chamber</strong></li>
<li>Stand clear while the baler is in operation</li>
<li>Allow only authorized and trained personnel to operate the baler</li>
<li>The baler has a keyed on/off switch — the key should be kept by the operator at all times</li>
</ul>
<h2>Control Panel</h2>
<ul>
<li><strong>On/Off Keyed Selector Switch:</strong> Activates all other controls. The baler cannot operate without the key turned on</li>
<li>Do not operate until you have read and understood all operating instructions</li>
</ul>
<h2>LOTO for Vertical Baler</h2>
<p>Before any maintenance, cleaning, or adjustment:</p>
<ol>
<li>Power off the machine</li>
<li>Flip the "Baler" breaker to OFF</li>
<li>Take a padlock from the LOTO board, lock the breaker in the off position</li>
<li>Remove the key and keep it on your person until work is complete</li>
<li>When done: unlock the breaker and return the lock and key to the LOTO board</li>
</ol>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 100,
              questions: [
                {
                  id: 'qbv1_1',
                  question: 'What is the most critical safety rule for the vertical baler?',
                  options: [
                    'Always wear gloves',
                    'Never place any part of your body inside the bale chamber',
                    'Keep the area clean',
                    'Check the oil daily'
                  ],
                  correct_index: 1,
                  explanation: 'This is a DANGER-level safety rule: Never place any part of your body inside the bale chamber. Violations can result in serious injury or death.'
                },
                {
                  id: 'qbv1_2',
                  question: 'Who is allowed to operate the vertical baler?',
                  options: [
                    'Any UCB employee',
                    'Any warehouse employee',
                    'Only authorized and trained personnel',
                    'Employees with 6 months experience'
                  ],
                  correct_index: 2,
                  explanation: 'Only authorized and trained personnel are allowed to operate the baler. The baler is equipped with a keyed on/off switch to control access.'
                }
              ]
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 6: Machine Operator Safety (Slitter, Slotter, Band Saw, Miter Saw)
  // ──────────────────────────────────────────────────────────
  {
    title: 'Machine Operator Safety Training',
    description: 'Safety training for operators of cutting machines at UCB — covering the Slitter, Slotter, Band Saw, and Miter Saw. All operators must complete this training before certification.',
    category: 'warehouse',
    thumbnail_color: '#dc2626',
    estimated_minutes: 30,
    is_published: true,
    sections: [
      {
        title: 'General Machine Safety Rules',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Rules That Apply to ALL Cutting Machines</h2>
<p>These rules apply to the Slitter, Slotter, Band Saw, and Miter Saw. Violations can result in serious injury. All operators must read, understand, and sign the applicable safety form before operating any machine.</p>
<ul>
<li>Always read the operator's manual before operating any machine</li>
<li><strong>LOTO is required</strong> before any servicing, cleaning, or adjustment of any machine</li>
<li><strong>Do not wear loose clothing, gloves, or jewelry</strong> while operating machines</li>
<li>Always wear approved <strong>protective safety glasses</strong></li>
<li>Keep <strong>hands and all body parts away from blades and moving parts</strong></li>
<li>Don't overreach — maintain proper footing and balance at all times</li>
<li>Keep all areas around machines clean and free of clutter</li>
<li><strong>Never stand on a machine</strong> — falling onto blades can cause serious cut injury</li>
<li>Feed work against the direction of rotation of the blade or cutter only</li>
<li><strong>Never leave a machine running while unattended</strong> — power off if you step away</li>
<li>All warehouse visitors must be kept a safe distance from machines</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 100,
              questions: [
                {
                  id: 'qm1_1',
                  question: 'What should you do if you need to step away from a running cutting machine?',
                  options: [
                    'Ask a coworker to watch it',
                    'Leave it running — it is safe',
                    'Power off the machine before stepping away',
                    'Reduce the speed before leaving'
                  ],
                  correct_index: 2,
                  explanation: 'Never leave a machine running while unattended. Always power off the machine if you need to step away, even briefly.'
                },
                {
                  id: 'qm1_2',
                  question: 'What clothing items are NOT allowed while operating cutting machines?',
                  options: [
                    'Safety glasses',
                    'Steel-toed boots',
                    'Loose clothing, gloves, and jewelry',
                    'High-visibility vests'
                  ],
                  correct_index: 2,
                  explanation: 'Loose clothing, gloves, and jewelry can catch in moving parts and cause serious injury. These are not allowed while operating any cutting machine.'
                },
                {
                  id: 'qm1_3',
                  question: 'Before servicing, cleaning, or adjusting any machine, what MUST you do?',
                  options: [
                    'Inform the Shift Lead',
                    'Follow Lockout/Tagout (LOTO) procedures',
                    'Wait until the machine cools down',
                    'Fill out a maintenance request form'
                  ],
                  correct_index: 1,
                  explanation: 'LOTO procedures MUST be followed before any servicing, cleaning, or adjustment of any machine. This is non-negotiable for all cutting equipment.'
                }
              ]
            }
          }
        ]
      },
      {
        title: 'Slitter Machine Operation',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Slitter Machine Overview</h2>
<p>The Slitting Machine Operator is responsible for operating, maintaining, and ensuring the safe use of the slitting machine to cut cardboard sheets.</p>
<h2>How to Power Off the Slitter for LOTO</h2>
<ol>
<li>Power off the machine</li>
<li>Flip the "Slitter" breaker on the right side of the machine to the DOWN position</li>
<li>Take a padlock from the LOTO board, lock the breaker in the off position</li>
<li>Remove the key — keep it on your person until finished with service</li>
<li>When complete: unlock the breaker and return lock and key to the LOTO board</li>
</ol>
<h2>Operating the Slitter — The Two-Cut Process</h2>
<ol>
<li><strong>Check the machine:</strong> Walk around and check for obstructions or damage to the machine or rollers</li>
<li><strong>The First Cut:</strong> Load a stack of boxes between the fences on the machine. The flaps of the boxes should barely touch the guide fences</li>
<li><strong>The Second Cut:</strong> Rotate the stack and align for the second cut following the same process</li>
</ol>
<h2>Slitter Certification</h2>
<p>All Slitter Machine Operators must read the full Operator's Manual, receive floor training from a certified operator, and sign the Slitter Machine Operator Certification form before operating independently.</p>`
            }
          }
        ]
      },
      {
        title: 'Band Saw Operation — 2-Person Procedure',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Band Saw Operator Role</h2>
<p>The Band Saw Operator is responsible for resizing totes using a band saw. This role <strong>requires a two-person operation</strong>:</p>
<ul>
<li><strong>Employee 1 (Pusher):</strong> Sets totes on the band saw table and pushes totes through the saw</li>
<li><strong>Employee 2 (Puller):</strong> Manages the cut totes and waste materials on the output side</li>
</ul>
<h2>Setting Up the Band Saw to Cut Totes</h2>
<ol>
<li>Place LOTO on the Band Saw and follow all LOTO procedures</li>
<li>Loosen the C clamps below the band saw table</li>
<li>Place a tote on the table, measure the distance to be cut, and write a mark on the tote</li>
<li>Line up the tote against the guide rail and saw blade</li>
<li>Move the saw forward or backward to line up with your cut mark</li>
<li>Install and secure the C Clamps on the saw table</li>
<li>Remove LOTO and verify the saw is safe and clear to power up</li>
<li>Do a test cut — only enough to check the cut height is correct</li>
<li>If not correct: power off, install LOTO, and readjust</li>
</ol>
<h2>Operating the Band Saw</h2>
<ul>
<li><strong>Pusher:</strong> Keep hands and all body parts at least <strong>12 inches from the saw blade</strong></li>
<li><strong>Puller:</strong> Pull the tote through and stack the resized tote on a pallet; place the cut strip separately for recycling</li>
<li>Stand clear of the saw and ensure the second person is also clear before powering on</li>
</ul>
<h2>Production Tracking</h2>
<p>Fill out the <strong>Shift Cutting Report</strong> with: date, names, quantity and size of totes taken from inventory, and the new size and quantity. Turn in to the office at end of shift.</p>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qbs2_1',
                  question: 'What is the minimum distance the Pusher must keep their hands from the band saw blade?',
                  options: ['6 inches', '12 inches', '18 inches', 'As close as needed'],
                  correct_index: 1,
                  explanation: 'The Pusher must keep hands and all body parts at least 12 inches from the saw blade at all times during operation.'
                },
                {
                  id: 'qbs2_2',
                  question: 'Why is the Band Saw operation a 2-person job?',
                  options: [
                    'Company policy requires it',
                    'One person pushes totes through while the other manages cut totes and waste on the output side',
                    'Two people are needed to move the band saw',
                    'It is not — one person can do it alone'
                  ],
                  correct_index: 1,
                  explanation: 'The Band Saw operation requires two people: the Pusher who feeds totes into the saw, and the Puller who manages the cut totes and cut strips on the other side.'
                }
              ]
            }
          }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // MODULE 7: Shift Lead Training
  // ──────────────────────────────────────────────────────────
  {
    title: 'Shift Lead Training',
    description: 'Comprehensive training for UCB Shift Leads covering facility operations oversight, daily responsibilities by day of the week, team management, safety enforcement, and end-of-shift reporting.',
    category: 'warehouse',
    thumbnail_color: '#1e40af',
    estimated_minutes: 30,
    is_published: true,
    sections: [
      {
        title: 'Shift Lead Role & Responsibilities',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>What Does the Shift Lead Do?</h2>
<p>The Shift Lead is responsible for the <strong>smooth operation of the facility</strong>. This includes safety as well as production. The Shift Lead keeps inventory organized and sets employees up with material to sort. The individual also unloads and loads trailers as directed.</p>
<p>The Shift Lead enforces all company/industry rules, policies, and standards for the production crew, and plans ahead so their area and teams are working safely.</p>
<h2>Core Responsibilities</h2>
<ul>
<li><strong>Daily Production Planning:</strong> Meet with the Production Manager to review daily goals and lead the <strong>8:00 AM roll call meeting</strong></li>
<li><strong>Forklift & Warehouse Coordination:</strong> Direct forklift drivers, keep the warehouse organized, ensure smooth material movement</li>
<li><strong>Performance & Staffing Management:</strong> Monitor employee productivity, ensure quotas are met, adjust staffing as needed</li>
<li><strong>Trailer & Driver Coordination:</strong> Communicate trailer status with the Production Manager; provide paperwork to drivers</li>
<li><strong>Safety & Policy Enforcement:</strong> Ensure adherence to safety protocols, enforce PPE use, uphold company policies</li>
<li><strong>End-of-Shift Setup & Reporting:</strong> Ensure finished products are stored, materials prepped for next shift, all paperwork completed</li>
</ul>`
            }
          }
        ]
      },
      {
        title: 'Daily Responsibilities by Day',
        content_blocks: [
          {
            type: 'text',
            content: {
              html: `<h2>Every Day (Daily Requirements)</h2>
<ul>
<li>Clock in/out using the online system</li>
<li>Complete yard checks every morning (if applicable)</li>
<li>Complete the pre-shift load tracking paperwork for trailers loaded/unloaded during the day — turn in with shift end report</li>
<li>Check and respond to emails/Microsoft Teams as needed throughout the day</li>
<li>Perform secondary tote inspections and daily Berry/cutting audits — upload with shift end report</li>
<li>Enter employee daily production and sort reports as needed</li>
<li>Complete forklift inspections and ensure all drivers do the same</li>
<li>Keep forklift drivers keeping product in front of the production team; pull finished goods and put away</li>
<li>Review Calendly and print pick list for the next day's business</li>
<li>Fill out the shift closing procedure form and submit with shift end report</li>
</ul>
<h2>Monday (Additional Tasks)</h2>
<ul>
<li>Have Hannibal and Milwaukee watch the General Mills sorting video during the morning meeting</li>
<li>Have Hannibal and Hunt Valley watch the Berry Quality Video during the morning meeting</li>
<li>(Both videos should be watched, alternating every other week)</li>
</ul>
<h2>Wednesday (Additional Tasks)</h2>
<ul>
<li>Physically count finished goods inventory with Manager and reconcile</li>
</ul>
<h2>Weekly (Monday)</h2>
<ul>
<li>Conduct a <strong>Weekly Safety Meeting</strong> during the morning meeting</li>
<li>Have all employees sign the safety paperwork and upload it into the system</li>
<li>Assist in counting/reconciling B2C inventory (Tuesday)</li>
</ul>`
            }
          },
          {
            type: 'quiz',
            content: {
              passing_score: 80,
              questions: [
                {
                  id: 'qsl1_1',
                  question: 'What time does the Shift Lead lead the daily roll call meeting?',
                  options: ['7:00 AM', '7:30 AM', '8:00 AM', '9:00 AM'],
                  correct_index: 2,
                  explanation: 'The Shift Lead leads the 8:00 AM roll call meeting to communicate daily tasks and expectations to the team.'
                },
                {
                  id: 'qsl1_2',
                  question: 'On which day does the Shift Lead conduct the Weekly Safety Meeting?',
                  options: ['Friday', 'Wednesday', 'Monday', 'It changes each week'],
                  correct_index: 2,
                  explanation: 'The Weekly Safety Meeting is conducted on Monday during the morning meeting. All employees must sign the safety paperwork.'
                },
                {
                  id: 'qsl1_3',
                  question: 'On Wednesday, what additional task must the Shift Lead complete?',
                  options: [
                    'Order new supplies',
                    'Physically count finished goods inventory with the Manager and reconcile',
                    'Conduct forklift certifications',
                    'Review employee schedules for the next week'
                  ],
                  correct_index: 1,
                  explanation: 'Every Wednesday, the Shift Lead must physically count finished goods inventory with the Manager and reconcile the count.'
                }
              ]
            }
          }
        ]
      }
    ]
  }
]

// ─────────────────────────────────────────────────────────────
// Seeding Functions
// ─────────────────────────────────────────────────────────────

async function seedModules() {
  console.log(`\n🌱 UCB Training Module Seeder`)
  console.log(`   Supabase: ${supabaseUrl}`)
  console.log(`   Seeding ${MODULES.length} training modules...\n`)

  let created = 0
  let errors = 0

  for (const mod of MODULES) {
    process.stdout.write(`  → ${mod.title}... `)

    try {
      // Get the first admin user to set as creator
      const { data: admin } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()

      const createdBy = admin?.id ?? null

      // Create the module
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .insert({
          title: mod.title,
          description: mod.description,
          category: mod.category,
          thumbnail_color: mod.thumbnail_color,
          estimated_minutes: mod.estimated_minutes,
          is_published: mod.is_published,
          created_by: createdBy,
        })
        .select()
        .single()

      if (moduleError) throw moduleError

      // Create sections
      for (let si = 0; si < mod.sections.length; si++) {
        const section = mod.sections[si]

        const { data: sectionData, error: sectionError } = await supabase
          .from('sections')
          .insert({
            module_id: moduleData.id,
            title: section.title,
            order_index: si,
          })
          .select()
          .single()

        if (sectionError) throw sectionError

        // Create content blocks
        for (let bi = 0; bi < section.content_blocks.length; bi++) {
          const block = section.content_blocks[bi]

          const { error: blockError } = await supabase
            .from('content_blocks')
            .insert({
              section_id: sectionData.id,
              type: block.type,
              order_index: bi,
              content: block.content,
            })

          if (blockError) throw blockError
        }
      }

      console.log(`✓ (${mod.sections.length} sections)`)
      created++
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`)
      errors++
    }
  }

  console.log(`\n  Done! Created: ${created}  Errors: ${errors}`)
  if (errors === 0) {
    console.log(`\n  ✅ All modules created and published!`)
    console.log(`     Log in as admin and go to Training Modules to see them.`)
    console.log(`     Assign them to employees via the Manager dashboard.\n`)
  }
}

seedModules().catch(console.error)
