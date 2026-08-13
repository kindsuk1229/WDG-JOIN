// ── WDG 골프 Rating 계산 엔진
// 기획안 기준: Rating 차이 반영 + 타수차 가중 + 참가인원 가중 + 동적 K값 + 업셋 보너스

export interface RatingUser {
  name: string;
  rating: number;
  rounds: number; // 누적 라운드 수
}

// ── 동적 K값
export function getK(rounds: number): number {
  if (rounds < 10) return 64;
  if (rounds < 30) return 32;
  return 16;
}

// ── 타수차 가중치
export function getScoreMultiplier(diff: number): number {
  if (diff === 0) return 1.0; // 동타
  if (diff === 1) return 1.0;
  if (diff >= 13) return 4.0;
  return Math.pow(3, (diff - 1) / 9);
}

// ── 참가인원 가중치
export function getPlayerMultiplier(count: number): number {
  if (count <= 4) return 1.0;
  return Math.min(3.0, Math.sqrt(count / 4));
}

// ── 업셋 보너스 (약자가 강자를 이겼을 때 추가 가중)
// 낮은 Rating이 높은 Rating을 이기면 → Rating 차이가 클수록 더 큰 보상
export function getUpsetBonus(
  myRating: number,
  oppRating: number,
  myScore: number,
  oppScore: number,
): number {
  const iWon = myScore < oppScore;
  const iAmUnderdog = myRating < oppRating;
  if (iWon && iAmUnderdog) {
    // 약자가 강자를 이긴 경우 → 보너스
    return Math.min(4.0, 1 + (oppRating - myRating) / 50);
  }
  return 1.0;
}

// ── 신뢰도 배지
export function getReliabilityBadge(rounds: number): { label: string; stars: number; color: string } {
  if (rounds < 5)  return { label: '미확정', stars: 0, color: 'text-red-400' };
  if (rounds < 15) return { label: '보통',   stars: 1, color: 'text-orange-400' };
  if (rounds < 30) return { label: '안정',   stars: 2, color: 'text-green-600' };
  return             { label: '검증',   stars: 3, color: 'text-blue-600' };
}

// ── Smart-Score 초기 Rating 산정
export function getInitialRating(avgScore: number | null, rounds: number): { rating: number; k: number } {
  if (!avgScore || avgScore === 0) return { rating: 1000, k: 64 };
  // 기준타 90, 타수차 × 6점
  const rating = Math.round(1000 + (90 - avgScore) * 6);
  const clampedRating = Math.max(700, Math.min(1300, rating));
  const k = rounds >= 10 ? 32 : 64;
  return { rating: clampedRating, k };
}

// ── 1:1 대결 Rating 변동 계산
export function calcDuel(
  myRating: number,
  oppRating: number,
  myScore: number,    // 타수 (낮을수록 좋음)
  oppScore: number,
  myRounds: number,
): number {
  const K = getK(myRounds);

  // 기대 승률 (255 사용)
  const E = 1 / (1 + Math.pow(10, (oppRating - myRating) / 255));

  // 실제 결과
  let result: number;
  const diff = Math.abs(myScore - oppScore);

  if (myScore < oppScore) {
    result = 1; // 승
  } else if (myScore > oppScore) {
    result = 0; // 패
  } else {
    result = 0.5; // 무
  }

  // 타수차 가중
  const scoreMultiplier = getScoreMultiplier(diff);

  // ✅ 업셋 보너스 (약자가 강자를 이겼을 때 추가 가중, 최대 ×4)
  const upsetBonus = getUpsetBonus(myRating, oppRating, myScore, oppScore);

  return K * (result - E) * scoreMultiplier * upsetBonus;
}

// ── 한 라운드 전체 Rating 계산
// players: { name, rating, rounds, score }[]
// 반환: { name, delta }[] — 각 플레이어의 Rating 변동량
export function calcRoundRating(
  players: { name: string; rating: number; rounds: number; score: number }[],
): { name: string; delta: number }[] {
  const n = players.length;
  const playerMultiplier = getPlayerMultiplier(n);
  const deltas: Record<string, number> = {};

  players.forEach(p => { deltas[p.name] = 0; });

  // 모든 1:1 조합
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = players[i];
      const b = players[j];

      const deltaA = calcDuel(a.rating, b.rating, a.score, b.score, a.rounds);
      const deltaB = calcDuel(b.rating, a.rating, b.score, a.score, b.rounds);

      deltas[a.name] += deltaA;
      deltas[b.name] += deltaB;
    }
  }

  // 평균 내고 참가인원 가중 적용
  const opponentCount = n - 1;
  return players.map(p => ({
    name: p.name,
    delta: Math.round((deltas[p.name] / opponentCount) * playerMultiplier),
  }));
}

// ── Rating 하한선
export const RATING_MIN = 600;
export const RATING_DEFAULT = 1000;

// ── 결석 패널티 (-10점/월)
export const ABSENCE_PENALTY = 10;