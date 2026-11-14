import type { Equipment, Exercise, ExerciseKind, Muscle } from './types';

const ex = (
  id: string,
  name: string,
  muscle: Muscle,
  equipment: Equipment,
  kind: ExerciseKind = 'weight',
): Exercise => ({ id, name, muscle, equipment, kind });

export const LIBRARY: Exercise[] = [
  // Chest
  ex('bench_bb', 'Bench Press (Barbell)', 'chest', 'barbell'),
  ex('bench_db', 'Bench Press (Dumbbell)', 'chest', 'dumbbell'),
  ex('incline_bench_bb', 'Incline Bench Press (Barbell)', 'chest', 'barbell'),
  ex('incline_bench_db', 'Incline Bench Press (Dumbbell)', 'chest', 'dumbbell'),
  ex('decline_bench_bb', 'Decline Bench Press (Barbell)', 'chest', 'barbell'),
  ex('chest_press_machine', 'Chest Press (Machine)', 'chest', 'machine'),
  ex('chest_fly_db', 'Chest Fly (Dumbbell)', 'chest', 'dumbbell'),
  ex('pec_deck', 'Pec Deck (Machine)', 'chest', 'machine'),
  ex('cable_crossover', 'Cable Crossover', 'chest', 'cable'),
  ex('push_up', 'Push Up', 'chest', 'bodyweight', 'bodyweight'),
  ex('chest_dip', 'Chest Dip', 'chest', 'bodyweight', 'bodyweight'),
  // Back
  ex('deadlift_bb', 'Deadlift (Barbell)', 'back', 'barbell'),
  ex('row_bb', 'Bent Over Row (Barbell)', 'back', 'barbell'),
  ex('row_db', 'One-Arm Row (Dumbbell)', 'back', 'dumbbell'),
  ex('tbar_row', 'T-Bar Row', 'back', 'machine'),
  ex('seated_row_cable', 'Seated Row (Cable)', 'back', 'cable'),
  ex('lat_pulldown', 'Lat Pulldown (Cable)', 'back', 'cable'),
  ex('straight_arm_pulldown', 'Straight-Arm Pulldown (Cable)', 'back', 'cable'),
  ex('pull_up', 'Pull Up', 'back', 'bodyweight', 'bodyweight'),
  ex('chin_up', 'Chin Up', 'back', 'bodyweight', 'bodyweight'),
  ex('back_extension', 'Back Extension', 'back', 'bodyweight', 'bodyweight'),
  ex('shrug_bb', 'Shrug (Barbell)', 'back', 'barbell'),
  ex('shrug_db', 'Shrug (Dumbbell)', 'back', 'dumbbell'),
  // Shoulders
  ex('ohp_bb', 'Overhead Press (Barbell)', 'shoulders', 'barbell'),
  ex('shoulder_press_db', 'Shoulder Press (Dumbbell)', 'shoulders', 'dumbbell'),
  ex('shoulder_press_machine', 'Shoulder Press (Machine)', 'shoulders', 'machine'),
  ex('arnold_press', 'Arnold Press (Dumbbell)', 'shoulders', 'dumbbell'),
  ex('lateral_raise_db', 'Lateral Raise (Dumbbell)', 'shoulders', 'dumbbell'),
  ex('lateral_raise_cable', 'Lateral Raise (Cable)', 'shoulders', 'cable'),
  ex('front_raise_db', 'Front Raise (Dumbbell)', 'shoulders', 'dumbbell'),
  ex('rear_delt_fly_db', 'Rear Delt Fly (Dumbbell)', 'shoulders', 'dumbbell'),
  ex('reverse_pec_deck', 'Reverse Pec Deck (Machine)', 'shoulders', 'machine'),
  ex('face_pull', 'Face Pull (Cable)', 'shoulders', 'cable'),
  // Biceps
  ex('curl_bb', 'Bicep Curl (Barbell)', 'biceps', 'barbell'),
  ex('curl_db', 'Bicep Curl (Dumbbell)', 'biceps', 'dumbbell'),
  ex('hammer_curl', 'Hammer Curl (Dumbbell)', 'biceps', 'dumbbell'),
  ex('incline_curl', 'Incline Curl (Dumbbell)', 'biceps', 'dumbbell'),
  ex('preacher_curl', 'Preacher Curl (Machine)', 'biceps', 'machine'),
  ex('curl_cable', 'Bicep Curl (Cable)', 'biceps', 'cable'),
  // Triceps
  ex('pushdown', 'Triceps Pushdown (Cable)', 'triceps', 'cable'),
  ex('overhead_ext_cable', 'Overhead Triceps Extension (Cable)', 'triceps', 'cable'),
  ex('overhead_ext_db', 'Overhead Triceps Extension (Dumbbell)', 'triceps', 'dumbbell'),
  ex('skullcrusher', 'Skullcrusher (Barbell)', 'triceps', 'barbell'),
  ex('close_grip_bench', 'Close-Grip Bench Press (Barbell)', 'triceps', 'barbell'),
  ex('triceps_dip', 'Triceps Dip', 'triceps', 'bodyweight', 'bodyweight'),
  // Forearms
  ex('wrist_curl', 'Wrist Curl (Dumbbell)', 'forearms', 'dumbbell'),
  ex('farmer_carry', "Farmer's Carry (Dumbbell)", 'forearms', 'dumbbell'),
  // Abs
  ex('crunch', 'Crunch', 'abs', 'bodyweight', 'bodyweight'),
  ex('cable_crunch', 'Cable Crunch', 'abs', 'cable'),
  ex('hanging_leg_raise', 'Hanging Leg Raise', 'abs', 'bodyweight', 'bodyweight'),
  ex('ab_wheel', 'Ab Wheel Rollout', 'abs', 'other', 'bodyweight'),
  ex('russian_twist', 'Russian Twist', 'abs', 'bodyweight', 'bodyweight'),
  // Quads
  ex('squat_bb', 'Squat (Barbell)', 'quads', 'barbell'),
  ex('front_squat', 'Front Squat (Barbell)', 'quads', 'barbell'),
  ex('hack_squat', 'Hack Squat (Machine)', 'quads', 'machine'),
  ex('leg_press', 'Leg Press (Machine)', 'quads', 'machine'),
  ex('leg_extension', 'Leg Extension (Machine)', 'quads', 'machine'),
  ex('goblet_squat', 'Goblet Squat (Dumbbell)', 'quads', 'dumbbell'),
  ex('bulgarian_split_squat', 'Bulgarian Split Squat (Dumbbell)', 'quads', 'dumbbell'),
  ex('lunge_db', 'Walking Lunge (Dumbbell)', 'quads', 'dumbbell'),
  // Hamstrings
  ex('rdl_bb', 'Romanian Deadlift (Barbell)', 'hamstrings', 'barbell'),
  ex('rdl_db', 'Romanian Deadlift (Dumbbell)', 'hamstrings', 'dumbbell'),
  ex('lying_leg_curl', 'Lying Leg Curl (Machine)', 'hamstrings', 'machine'),
  ex('seated_leg_curl', 'Seated Leg Curl (Machine)', 'hamstrings', 'machine'),
  ex('good_morning', 'Good Morning (Barbell)', 'hamstrings', 'barbell'),
  // Glutes
  ex('hip_thrust', 'Hip Thrust (Barbell)', 'glutes', 'barbell'),
  ex('glute_bridge', 'Glute Bridge', 'glutes', 'bodyweight', 'bodyweight'),
  ex('cable_kickback', 'Glute Kickback (Cable)', 'glutes', 'cable'),
  ex('hip_abduction', 'Hip Abduction (Machine)', 'glutes', 'machine'),
  // Calves
  ex('standing_calf_raise', 'Standing Calf Raise (Machine)', 'calves', 'machine'),
  ex('seated_calf_raise', 'Seated Calf Raise (Machine)', 'calves', 'machine'),
  // Full body
  ex('power_clean', 'Power Clean (Barbell)', 'full_body', 'barbell'),
  ex('kb_swing', 'Kettlebell Swing', 'full_body', 'kettlebell'),
  ex('thruster_db', 'Thruster (Dumbbell)', 'full_body', 'dumbbell'),
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  full_body: 'Full body',
  other: 'Other',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};
