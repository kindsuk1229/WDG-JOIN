// ── WDG 골프 Rating 계산 엔진
// 기획안 기준: Rating 차이 반영 + 타수차 가중 + 참가인원 가중 + 동적 K값 + 업셋 보너스 + 반복 상대 가중

export interface RatingUser {
  name: string;
  rating: number;
  rounds: number;
}

// ── 동적 K값
export function getK(rounds: number): number {
  if (rounds < 10) return 64;
  if (rounds < 30) return 32;
  return 16;
}

// ── 타수차 가중치
export function getScoreMultiplier(diff: number): number {
  if (diff === 0) return 1.0;
  if (diff === 1) return 1.0;
  if (diff >= 13) return 4.0;
  return Math.pow(3, (diff - 1) / 9);
}

// ── 참가인원 가중치
// 4명 = ×1.00, 48명 = ×2.00 선형 증가, 48명 이상 상한 고정
export function getPlayerMultiplier(count: number): number {
  if (count <= 4) return 1.0;
  return Math.min(2.0, 1.0 + (count - 4) / 44);
}

// ── 업셋 보너스 (약자가 강자를 이겼을 때 추가 가중)
export function getUpsetBonus(
  myRating: number,
  oppRating: number,
  myScore: number,
  oppScore: number,
): number {
  const iWon = myScore < oppScore;
  const iAmUnderdog = myRating < oppRating;
  if (iWon && iAmUnderdog) {
    return Math.min(4.0, 1 + (oppRating - myRating) / 50);
  }
  return 1.0;
}

// ── 반복 상대 가중치 (최근 7라운드 기준)
// 같은 상대와 자주 경기할수록 점수 감소 (어뷰징 방지)
// 처음 만나는 상대는 보너스
export function getRepeatOpponentMultiplier(meetCount: number): number {
  if (meetCount <= 1) return 1.3;  // 처음/두번째 → 보너스
  if (meetCount === 2) return 1.0; // 세번째 → 정상
  if (meetCount === 3) return 0.8; // 네번째 → 감소
  if (meetCount === 4) return 0.6; // 다섯번째 → 감소
  return 0.5;                      // 여섯번+  → 최대 패널티
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
  const rating = Math.round(1000 + (90 - avgScore) * 6);
  const clampedRating = Math.max(700, Math.min(1300, rating));
  const k = rounds >= 10 ? 32 : 64;
  return { rating: clampedRating, k };
}

// ── 1:1 대결 Rating 변동 계산
export function calcDuel(
  myRating: number,
  oppRating: number,
  myScore: number,
  oppScore: number,
  myRounds: number,
  meetCount: number = 1, // 최근 7라운드 내 해당 상대와 만난 횟수
): number {
  const K = getK(myRounds);
  const E = 1 / (1 + Math.pow(10, (oppRating - myRating) / 255));

  let result: number;
  const diff = Math.abs(myScore - oppScore);

  if (myScore < oppScore) result = 1;
  else if (myScore > oppScore) result = 0;
  else result = 0.5;

  // 타수차 가중
  const scoreMultiplier = getScoreMultiplier(diff);

  // 업셋 보너스 — 둘 중 큰 값만 사용
  const upsetBonus = getUpsetBonus(myRating, oppRating, myScore, oppScore);
  const matchMultiplier = Math.max(scoreMultiplier, upsetBonus);

  // ✅ 반복 상대 가중치 적용
  const repeatMultiplier = getRepeatOpponentMultiplier(meetCount);

  return K * (result - E) * matchMultiplier * repeatMultiplier;
}

// ── 한 라운드 전체 Rating 계산
// recentOpponents: 각 플레이어별 최근 7라운드 상대 목록 { [name]: string[] }
export function calcRoundRating(
  players: { name: string; rating: number; rounds: number; score: number }[],
  recentOpponents: Record<string, string[]> = {}, // ✅ 최근 7라운드 상대 기록
): { name: string; delta: number }[] {
  const n = players.length;
  const playerMultiplier = getPlayerMultiplier(n);
  const deltas: Record<string, number> = {};

  players.forEach(p => { deltas[p.name] = 0; });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = players[i];
      const b = players[j];

      // 최근 7라운드 내 서로 만난 횟수
      const aRecentOpps = recentOpponents[a.name] || [];
      const bRecentOpps = recentOpponents[b.name] || [];
      const meetCountA = aRecentOpps.filter(name => name === b.name).length;
      const meetCountB = bRecentOpps.filter(name => name === a.name).length;

      const deltaA = calcDuel(a.rating, b.rating, a.score, b.score, a.rounds, meetCountA);
      const deltaB = calcDuel(b.rating, a.rating, b.score, a.score, b.rounds, meetCountB);

      deltas[a.name] += deltaA;
      deltas[b.name] += deltaB;
    }
  }

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