import React from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, FileWarning } from 'lucide-react';

export function ActionRequiredWidget({ data }: any) {
    const passCount = data?.passCount || 0;
    const immediateActionCount = data?.immediateActionCount || 0;
    const immediateActionUnfilled = data?.immediateActionUnfilled || 0;
    const capCount = data?.capCount || 0;
    const capUnfilled = data?.capUnfilled || 0;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 min-w-[340px]">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase">Action Required</h2>
            </div>

            <div className="p-3 flex flex-col gap-2">
                {/* Immediate Action Row */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-xl text-red-600">{immediateActionCount}</div>
                            <div className="text-[11px] font-semibold text-red-500 leading-tight mt-0.5">Immediate Action Required</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
                        <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-xl text-orange-600">{immediateActionUnfilled}</div>
                            <div className="text-[11px] font-semibold text-orange-500 leading-tight mt-0.5">Immediate Action Not Completed</div>
                        </div>
                    </div>
                </div>

                {/* CAP Row */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                        <FileWarning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-xl text-amber-600">{capCount}</div>
                            <div className="text-[11px] font-semibold text-amber-500 leading-tight mt-0.5">Corrective Action Plan (CAP) Required</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3">
                        <FileWarning className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-xl text-yellow-600">{capUnfilled}</div>
                            <div className="text-[11px] font-semibold text-yellow-500 leading-tight mt-0.5">Corrective Action Plan (CAP) Not Completed</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

