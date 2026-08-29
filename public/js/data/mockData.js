/**
 * SIH26031 - Realistic Sample Initial Lots Database
 */

export const INITIAL_LOTS = [
  {
    lot_id: "LOT-2026-0829-001",
    farmer_name: "Rameshwar Patil",
    supplier_contact: "+91 98230 11452",
    vehicle_number: "MH-15-EG-4821",
    quantity_quintals: 120,
    procurement_centre: "Lasalgaon Central Mandi (Hub 4)",
    inspector_id: "INS-9042 (S. K. Verma)",
    registration_date: "2026-08-29 09:30 AM",
    status: "ACCEPTED",
    ai_results: {
      total_inspected: 32,
      good: 26,
      damaged: 2,
      rotten: 1,
      sprouted: 1,
      undersized: 2,
      grade_a_percentage: 81.3,
      urs_percentage: 18.7,
      confidence_score: 0.93,
      size_distribution: { "35-44mm": 2, "45-54mm": 18, "55-64mm": 9, "65mm+": 3 },
      annotated_image: "assets/sample_onion_batch.jpg"
    },
    review: {
      decision: "ACCEPT",
      rejection_reason: "",
      grade_a_override: 81.3,
      urs_override: 18.7,
      inspector_notes: "Lot meets FAQ Grade A standards (>80%). Low rot count. Approved for central procurement warehousing.",
      inspector_signature: "S. K. Verma (Digital Sign-off ID #9042)",
      reviewed_at: "2026-08-29 09:48 AM"
    }
  },
  {
    lot_id: "LOT-2026-0829-002",
    farmer_name: "Ganesh Trimbak Pawar",
    supplier_contact: "+91 94222 88319",
    vehicle_number: "MH-18-BC-9012",
    quantity_quintals: 85,
    procurement_centre: "Pimpalgaon Baswant Hub",
    inspector_id: "INS-9042 (S. K. Verma)",
    registration_date: "2026-08-29 11:15 AM",
    status: "REJECTED",
    ai_results: {
      total_inspected: 28,
      good: 15,
      damaged: 4,
      rotten: 5,
      sprouted: 3,
      undersized: 1,
      grade_a_percentage: 53.6,
      urs_percentage: 46.4,
      confidence_score: 0.91,
      size_distribution: { "35-44mm": 1, "45-54mm": 14, "55-64mm": 10, "65mm+": 3 },
      annotated_image: "assets/sample_onion_batch.jpg"
    },
    review: {
      decision: "REJECT",
      rejection_reason: "High Rotten/Black Mold Ratio (>15% threshold exceeded)",
      grade_a_override: 53.6,
      urs_override: 46.4,
      inspector_notes: "Excessive black mold rot detected in sample. Exceeds permissible sub-standard limits.",
      inspector_signature: "S. K. Verma (Digital Sign-off ID #9042)",
      reviewed_at: "2026-08-29 11:32 AM"
    }
  },
  {
    lot_id: "LOT-2026-0829-003",
    farmer_name: "Dnyaneshwar Shinde",
    supplier_contact: "+91 98901 44321",
    vehicle_number: "MH-16-AY-3390",
    quantity_quintals: 210,
    procurement_centre: "Nashik APMC Main Gate",
    inspector_id: "INS-8810 (P. R. Deshmukh)",
    registration_date: "2026-08-29 01:45 PM",
    status: "PENDING_REVIEW",
    ai_results: {
      total_inspected: 35,
      good: 29,
      damaged: 2,
      rotten: 0,
      sprouted: 1,
      undersized: 3,
      grade_a_percentage: 82.9,
      urs_percentage: 17.1,
      confidence_score: 0.95,
      size_distribution: { "35-44mm": 3, "45-54mm": 20, "55-64mm": 9, "65mm+": 3 },
      annotated_image: "assets/sample_onion_batch.jpg"
    },
    review: null
  }
];
