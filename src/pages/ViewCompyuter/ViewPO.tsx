import { useEffect, useState } from "react";
import axioss from "../../api/axios";
import { BASE_URL } from "../../utils/urls";
import {useParams} from "react-router-dom";

type PpeInfo = {
    id: number;
    name: string;
    size?: string | null;
    type_product: string | null;
    type_product_display?: string | null;
    renewal_months: number;
    is_new?: boolean | null;
};

type ItemDetail = {
    id?: number;
    issued_at?: string | null;
    issued_by_info?: {
        id: number;
        username: string;
        full_name: string;
    } | null;
    ppeproduct?: Array<number | { id: number; name?: string }>;
    ppeproduct_info?: PpeInfo[];
    employee?: {
        id?: number;
    };
    issue_history?: Array<{
        id: number;
        slug?: string | null;
        issued_at?: string | null;
        next_due_date?: string | null;
        is_current?: boolean;
        issued_by_info?: {
            id: number;
            username: string;
            full_name: string;
        } | null;
        ppeproduct_info?: PpeInfo[];
    }>;
};

export default function ViewPO() {
    const [itemDetailData, setItemDetailData] = useState<ItemDetail | null>(null);
    const { slug } = useParams();

    const formatDate = (value?: string | null) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const calculateNextIssueDate = (issuedAt?: string | null, renewalMonths?: number) => {
        if (!issuedAt || renewalMonths === undefined || renewalMonths === null) return '-';
        const date = new Date(issuedAt);
        if (Number.isNaN(date.getTime())) return '-';
        date.setMonth(date.getMonth() + renewalMonths);
        return formatDate(date.toISOString());
    };

    const historyGroups = (itemDetailData?.issue_history ?? []).filter(
        (issue) => (issue.ppeproduct_info ?? []).length > 0,
    );

            useEffect(() => {
                        if (!slug) return;

                axioss
                    .get(`${BASE_URL}/item-view/${slug}`)
                    .then(async (response) => {
                        const detail = response.data as ItemDetail;
                        const hasHistory = Array.isArray(detail.issue_history) && detail.issue_history.length > 0;
                        const employeeId = detail.employee?.id;

                        if (hasHistory || !employeeId) {
                                setItemDetailData(detail);
                                return;
                        }

                        try {
                                const allItemsResponse = await axioss.get(
                                        `${BASE_URL}/all-items/?employee_id=${employeeId}&no_pagination=true`,
                                );

                                const items = Array.isArray(allItemsResponse.data) ? allItemsResponse.data : [];
                                const fallbackHistory = items
                                        .map((item: ItemDetail) => ({
                                                id: Number(item.id),
                                                slug: (item as any).slug ?? null,
                                                issued_at: item.issued_at ?? null,
                                                next_due_date: (item as any).next_due_date ?? null,
                                                is_current: Number(item.id) === Number(detail.id),
                                                issued_by_info: item.issued_by_info ?? null,
                                                ppeproduct_info: item.ppeproduct_info ?? [],
                                    }))
                                    .filter((item) => Number.isFinite(item.id));

                                setItemDetailData({
                                        ...detail,
                                        issue_history: fallbackHistory,
                                });
                        } catch (historyError) {
                                console.log(historyError);
                                setItemDetailData(detail);
                        }
                    })
                    .catch((err) => console.log(err));
                }  , [slug]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12">
            <div className="col-span-12 mx-3">
                <div className="rounded-md border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
                    <div className="px-4 py-3 border-b border-stroke dark:border-strokedark">
                        <h2 className="font-semibold">Средства защиты</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-stroke dark:border-strokedark text-left">
                                    <th className="px-4 py-3 w-16">№</th>
                                    <th className="px-4 py-3">Наименование</th>
                                    <th className="px-4 py-3">Размер</th>
                                    <th className="px-4 py-3">Ед. изм.</th>
                                    <th className="px-4 py-3">Срок обновления (мес.)</th>
                                    <th className="px-4 py-3">Дата выдачи</th>
                                    <th className="px-4 py-3">Следующая выдача</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyGroups.length > 0 ? (
                                    historyGroups.map((issue, issueIndex) =>
                                        (issue.ppeproduct_info ?? []).map((product, productIndex) => (
                                            <tr
                                                key={`${issue.id}-${product.id}-${productIndex}`}
                                                className={`border-b border-stroke dark:border-strokedark ${issue.is_current ? 'bg-green-50/40 dark:bg-transparent' : ''} ${issueIndex > 0 && productIndex === 0 ? 'border-t-4 border-t-slate-500 dark:border-t-slate-400' : ''}`}
                                            >
                                                <td className="px-4 py-3">{productIndex + 1}</td>
                                                <td className="px-4 py-3">{product.name || '-'}</td>
                                                <td className="px-4 py-3">{product.size || '-'}</td>
                                                <td className="px-4 py-3">{product.type_product_display || product.type_product || '-'}</td>
                                                <td className="px-4 py-3">{product.renewal_months ?? '-'}</td>
                                                <td className="px-4 py-3">{formatDate(issue.issued_at)}</td>
                                                <td className="px-4 py-3">{calculateNextIssueDate(issue.issued_at, product.renewal_months)}</td>
                                            </tr>
                                        )),
                                    )
                                ) : itemDetailData?.ppeproduct_info && itemDetailData.ppeproduct_info.length > 0 ? (
                                    itemDetailData.ppeproduct_info.map((row, index) => (
                                        <tr key={row.id} className="border-b border-stroke dark:border-strokedark">
                                            <td className="px-4 py-3">{index + 1}</td>
                                            <td className="px-4 py-3">{row.name || '-'}</td>
                                            <td className="px-4 py-3">{row.size || '-'}</td>
                                            <td className="px-4 py-3">{row.type_product_display || row.type_product || '-'}</td>
                                            <td className="px-4 py-3">{row.renewal_months ?? '-'}</td>
                                            <td className="px-4 py-3">{formatDate(itemDetailData.issued_at)}</td>
                                            <td className="px-4 py-3">{calculateNextIssueDate(itemDetailData.issued_at, row.renewal_months)}</td>
                                        </tr>
                                    ))
                                ) : itemDetailData?.ppeproduct && itemDetailData.ppeproduct.length > 0 ? (
                                    itemDetailData.ppeproduct.map((row, index) => (
                                        <tr key={index} className="border-b border-stroke dark:border-strokedark">
                                            <td className="px-4 py-3">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                {typeof row === 'number' ? `ID: ${row}` : row.name || `ID: ${row.id}`}
                                            </td>
                                            <td className="px-4 py-3">-</td>
                                            <td className="px-4 py-3">-</td>
                                            <td className="px-4 py-3">-</td>
                                            <td className="px-4 py-3">{formatDate(itemDetailData.issued_at)}</td>
                                            <td className="px-4 py-3">-</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                                            Данные отсутствуют
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
