/** Fragment inject for GatingLabelLayer (DECKGL_FILTER_COLOR). */
export const GATING_FILTER_COLOR_INJECT = `
uniform sampler2D u_ids;
uniform sampler2D u_centers;
uniform sampler2D u_mag_0;
uniform sampler2D u_mag_1;
uniform sampler2D u_mag_2;
uniform sampler2D u_mag_3;
uniform sampler2D u_gatings;
uniform sampler2D u_pickings;
uniform float u_texture_width;
uniform float u_cell_count;
uniform int u_draw_mode;
uniform int u_eval_and;
uniform vec3 u_gate_color_0;
uniform vec3 u_gate_color_1;
uniform vec3 u_gate_color_2;
uniform vec3 u_gate_color_3;
uniform int u_active_gates;

float sample1D(sampler2D tex, float idx) {
  float w = u_texture_width;
  float x = mod(idx, w) / w;
  float y = floor(idx / w) / max(1.0, ceil(u_cell_count / w));
  return texture2D(tex, vec2(x + 0.5 / w, y + 0.5 / max(1.0, ceil(u_cell_count / w)))).r;
}

int cellIndexFromId(float cellId) {
  float n = min(u_cell_count, 1048576.0);
  for (float i = 0.0; i < n; i += 1.0) {
    if (abs(sample1D(u_ids, i) - cellId) < 0.5) {
      return int(i);
    }
  }
  return -1;
}

void applyGatingColor(inout vec4 color) {
  float rawId = color.r;
  if (rawId < 0.5) {
    color = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  int idx = cellIndexFromId(rawId);
  if (idx < 0) {
    color = vec4(0.05, 0.05, 0.05, 0.15);
    return;
  }

  float fi = float(idx);
  float g0 = sample1D(u_gatings, fi * 4.0 + 0.0);
  float g1 = sample1D(u_gatings, fi * 4.0 + 1.0);
  float g2 = sample1D(u_gatings, fi * 4.0 + 2.0);
  float g3 = sample1D(u_gatings, fi * 4.0 + 3.0);
  float pick = sample1D(u_pickings, fi);

  bool pass = u_eval_and > 0
    ? (g0 > 0.5 || u_active_gates < 1) && (g1 > 0.5 || u_active_gates < 2) && (g2 > 0.5 || u_active_gates < 3) && (g3 > 0.5 || u_active_gates < 4)
    : (g0 > 0.5 && u_active_gates >= 1) || (g1 > 0.5 && u_active_gates >= 2) || (g2 > 0.5 && u_active_gates >= 3) || (g3 > 0.5 && u_active_gates >= 4) || u_active_gates < 1;

  if (u_draw_mode == 2) {
    float edge = step(0.02, fract(rawId * 0.013));
    if (edge > 0.5 && pass) {
      color = vec4(1.0, 1.0, 1.0, 0.9);
      return;
    }
    color = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  if (!pass && pick < 0.5) {
    color = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec3 outRgb = vec3(0.0);
  if (u_active_gates >= 1) outRgb += u_gate_color_0 * sample1D(u_mag_0, fi) * g0;
  if (u_active_gates >= 2) outRgb += u_gate_color_1 * sample1D(u_mag_1, fi) * g1;
  if (u_active_gates >= 3) outRgb += u_gate_color_2 * sample1D(u_mag_2, fi) * g2;
  if (u_active_gates >= 4) outRgb += u_gate_color_3 * sample1D(u_mag_3, fi) * g3;

  if (u_draw_mode == 1 && u_eval_and < 1) {
    float angle = atan(sample1D(u_mag_0, fi), sample1D(u_mag_1, fi));
    float slice = step(0.0, sin(angle * float(u_active_gates)));
    outRgb *= slice;
  }

  if (pick > 0.5) {
    outRgb = mix(outRgb, vec3(1.0, 1.0, 0.2), 0.45);
  }

  color = vec4(clamp(outRgb, 0.0, 1.0), pass || pick > 0.5 ? 0.65 : 0.0);
}
`;
