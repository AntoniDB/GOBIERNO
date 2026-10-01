"use client";

import { useEffect, useState } from "react";
import type { PartyState } from "@/lib/engine/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import type { SimulateVoteResult } from "@/app/actions/congress";
import { simulateVoteAction } from "@/app/actions/congress";
import { useGameStore } from "@/lib/store/game-store";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  MinusIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";

function VoteBar({
  label,
  result,
}: {
  label: string;
  result: { for: number; against: number; abstain: number; total: number } | null;
}) {
  if (!result || result.total === 0) return null;

  const forPct = (result.for / result.total) * 100;
  const againstPct = (result.against / result.total) * 100;
  const abstainPct = (result.abstain / result.total) * 100;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <ThumbsUpIcon className="size-3" /> {result.for}
        </span>
        <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden flex">
          {forPct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
          )}
          {abstainPct > 0 && (
            <div
              className="h-full bg-muted-foreground/40 transition-all"
              style={{ width: `${abstainPct}%` }}
            />
          )}
          {againstPct > 0 && (
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${againstPct}%` }}
            />
          )}
        </div>
        <span className="flex items-center gap-1 text-red-400">
          <ThumbsDownIcon className="size-3" /> {result.against}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
          <MinusIcon className="size-3" /> {result.abstain}
        </span>
      </div>
    </div>
  );
}

export function LawProposalModal({
  open,
  onClose,
  lawKey,
  lawName,
  lawDescription,
  monthlyCost = 0,
  enactmentCost = 0,
  treasury,
  parties,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  lawKey: string;
  lawName: string;
  lawDescription: string;
  /** Costo mensual recurrente, escalado a la población (0 = sin costo mensual) */
  monthlyCost?: number;
  /** Costo único al promulgar, escalado (positivo = gasto, negativo = ingreso) */
  enactmentCost?: number;
  /** Tesoro actual, para advertir si el costo único no alcanza */
  treasury?: number;
  senators: { id: string; partyId: string; name: string; personalIdeology: { economic: number; social: number; authority: number }; chamber: "LOWER" | "UPPER"; loyalty: number }[];
  parties: PartyState[];
  approval: number;
  onConfirm: () => void;
}) {
  const gameId = useGameStore((s) => s.gameId);
  const pendingInput = useGameStore((s) => s.pendingInput);
  const proposedLaws = pendingInput.proposedLaws ?? [];
  const isAlreadyProposed = proposedLaws.includes(lawKey);

  const [voteResult, setVoteResult] = useState<SimulateVoteResult | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);

  useEffect(() => {
    if (!open || !gameId) return;
    let cancelled = false;
    void (async () => {
      setVoteLoading(true);
      setVoteResult(null);
      const result = await simulateVoteAction(gameId, lawKey);
      if (!cancelled) {
        setVoteResult(result);
        setVoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, gameId, lawKey]);

  const isLoading = voteLoading || (!voteResult && open && !!gameId);

  const partyNames = parties.map((p) => p.name);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proponer ley: {lawName}</DialogTitle>
          <DialogDescription>{lawDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(monthlyCost > 0 || enactmentCost !== 0) && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
              {monthlyCost > 0 && (
                <p>Costo mensual mientras esté vigente: <strong>M$ {(monthlyCost / 1_000_000).toFixed(0)}</strong></p>
              )}
              {enactmentCost > 0 && (
                <p>Costo único al promulgar: <strong>M$ {(enactmentCost / 1_000_000).toFixed(0)}</strong></p>
              )}
              {enactmentCost < 0 && (
                <p>Ingreso único al promulgar: <strong>M$ {(-enactmentCost / 1_000_000).toFixed(0)}</strong></p>
              )}
              {enactmentCost > 0 && treasury !== undefined && treasury < enactmentCost && (
                <p className="text-destructive">
                  El tesoro actual (M$ {(treasury / 1_000_000).toFixed(0)}) no alcanza: quedará en M$ {((treasury - enactmentCost) / 1_000_000).toFixed(0)}.
                </p>
              )}
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          )}

          {!isLoading && voteResult && (
            <>
              <div className="space-y-3">
                <VoteBar label="Cámara Baja" result={voteResult.lower} />
                <VoteBar label="Cámara Alta" result={voteResult.upper} />
              </div>

              <div className="flex items-center justify-center">
                {voteResult.overallApproved ? (
                  <Badge className="gap-1 text-sm px-3 py-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircleIcon className="size-4" />
                    APROBADA
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-sm px-3 py-1">
                    <XCircleIcon className="size-4" />
                    RECHAZADA
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Desglose por partido
                </span>
                <Card className="overflow-hidden" size="sm">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-3 text-muted-foreground font-medium">
                          Partido
                        </th>
                        <th className="text-center py-1.5 px-2 text-emerald-400 font-medium w-10">
                          <ThumbsUpIcon className="size-3 inline" />
                        </th>
                        <th className="text-center py-1.5 px-2 text-red-400 font-medium w-10">
                          <ThumbsDownIcon className="size-3 inline" />
                        </th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium w-10">
                          <MinusIcon className="size-3 inline" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyNames.map((pName) => {
                        const lp = voteResult.perPartyLower[pName] ?? { for: 0, against: 0, abstain: 0, total: 0 };
                        const up = voteResult.perPartyUpper[pName] ?? { for: 0, against: 0, abstain: 0, total: 0 };
                        const totalFor = lp.for + up.for;
                        const totalAgainst = lp.against + up.against;
                        const totalAbstain = lp.abstain + up.abstain;
                        if (totalFor === 0 && totalAgainst === 0 && totalAbstain === 0) return null;
                        return (
                          <tr key={pName} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 px-3 font-medium text-foreground truncate max-w-[120px]">
                              {pName}
                            </td>
                            <td className="text-center py-1.5 px-2 text-emerald-400 tabular-nums">
                              {totalFor}
                            </td>
                            <td className="text-center py-1.5 px-2 text-red-400 tabular-nums">
                              {totalAgainst}
                            </td>
                            <td className="text-center py-1.5 px-2 text-muted-foreground tabular-nums">
                              {totalAbstain}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </div>

        <DialogFooter showCloseButton={false}>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || isAlreadyProposed}
          >
            {isAlreadyProposed ? "Ya propuesta este mes" : "Confirmar propuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
