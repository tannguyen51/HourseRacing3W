import { request } from "./apiClient";

const unwrap = (r) => r?.data ?? r?.Data ?? r;

export const getRaceSimulation = async (raceId) =>
  unwrap(await request(`/api/races/${raceId}/simulation`));