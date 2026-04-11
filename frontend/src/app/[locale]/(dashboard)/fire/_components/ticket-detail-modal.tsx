"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type TicketRead } from "@/lib/api/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface TicketDetailModalProps {
    ticket: TicketRead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TicketDetailModal({ ticket, open, onOpenChange }: TicketDetailModalProps) {
    if (!ticket) return null;

    const analysis = ticket.ai_analysis;
    const manager = ticket.assigned_manager;
    const routing = ticket.routing_result as
        | ({ routing_error?: string | null } & Record<string, unknown>)
        | null
        | undefined;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl">
                            Ticket #{ticket.id.slice(0, 8)}
                        </DialogTitle>
                        <div className="flex gap-2">
                            {analysis?.ai_priority && (
                                <Badge variant={analysis.ai_priority > 7 ? "destructive" : analysis.ai_priority > 4 ? "default" : "secondary"}>
                                    Priority: {analysis.ai_priority}/10
                                </Badge>
                            )}
                            {analysis?.ai_type && (
                                <Badge variant="outline">{analysis.ai_type}</Badge>
                            )}
                            {analysis?.ai_tone && (
                                <Badge variant="secondary">{analysis.ai_tone}</Badge>
                            )}
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                        Created on {format(new Date(ticket.created_at), "PPpp")}
                        {ticket.client_city && ` • City: ${ticket.client_city}`}
                        {ticket.client_segment && ` • Segment: ${ticket.client_segment}`}
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 pb-6 pt-2">
                    <div className="space-y-6">
                        {/* Original Client Request */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Original Request</h3>
                            <div className="bg-muted/50 p-4 rounded-md text-sm leading-relaxed whitespace-pre-wrap">
                                {ticket.description}
                            </div>
                        </div>

                        {/* AI Summary */}
                        {analysis?.ai_summary && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">AI Summary</h3>
                                <div className="bg-primary/5 p-4 rounded-md border border-primary/10 text-sm leading-relaxed">
                                    {analysis.ai_summary}
                                </div>
                            </div>
                        )}

                        <Separator />

                        {/* Assignment Justification */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Assignment Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-md border">
                                    <h4 className="font-medium text-sm mb-1">Assigned Manager</h4>
                                    {manager ? (
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="font-semibold">{manager.full_name}</span>
                                            <span className="text-xs text-muted-foreground">Role: {manager.role}</span>
                                            <span className="text-xs text-muted-foreground">Load: {manager.current_load} tickets</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {manager.skills.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Unassigned</span>
                                    )}
                                </div>
                                <div className="p-4 rounded-md border bg-muted/20">
                                    <h4 className="font-medium text-sm mb-1">AI Reasoning (Justification)</h4>
                                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                        {(typeof routing?.justification === "string" ? routing.justification : null)
                                            || routing?.routing_error
                                            || "No specific AI justification provided for this routing decision."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {analysis?.ai_recommendation && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">AI Recommendation</h3>
                                <div className="bg-amber-500/5 p-4 rounded-md border border-amber-500/20 text-sm leading-relaxed">
                                    {analysis.ai_recommendation}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
