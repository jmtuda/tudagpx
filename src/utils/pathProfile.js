// Generic road/path matching, with no surface, track grade or elevation penalties.
// Based on BRouter's shortest profile (abrensch/brouter, MIT), with a small turn
// cost to avoid unnecessary zigzags and explicit bicycle + pedestrian coverage.
export const pathProfile = `
---context:global
assign validForBikes true
assign validForFoot true
assign considerTurnRestrictions false
assign turnInstructionMode 0
assign correctMisplacedViaPoints false
assign downhillcost 0
assign uphillcost 0

---context:way
assign dummyUsage or surface= tracktype=
assign defaultaccess
  if access=private|no then false
  else if motorroad=yes then false
  else true
assign bikeaccess
  if bicycle= then
    if vehicle= then defaultaccess
    else not vehicle=private|no
  else not bicycle=private|no|dismount|use_sidepath
assign footaccess
  if bicycle=dismount then true
  else if foot= then defaultaccess
  else not foot=private|no|use_sidepath
assign nodeaccessgranted or bikeaccess footaccess
assign turncost 10
assign initialclassifier if route=ferry then 1 else 0
assign initialcost if route=ferry then 10000 else 0
assign costfactor
  if not or bikeaccess footaccess then 100000
  else if highway= then 100000
  else if highway=motorway|motorway_link|construction|proposed|abandoned then 100000
  else 1

---context:node
assign defaultaccess not access=private|no
assign bikeaccess
  if bicycle= then
    if vehicle= then defaultaccess
    else not vehicle=private|no
  else not bicycle=private|no|dismount
assign footaccess
  if bicycle=dismount then true
  else if foot= then defaultaccess
  else not foot=private|no
assign initialcost if or bikeaccess footaccess then 0 else 1000000
`;
