"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockLevelChart } from "@/components/charts/stock-level-chart";
import { isLowStock, stockLevels } from "@/lib/data/compute";
import type { MaterialBoard } from "@/lib/data/material";
import { materialCategoryLabel } from "@/lib/labels";
import { formatINR, formatNumber } from "@/lib/utils";

export function InventoryTab({ board }: { board: MaterialBoard }) {
  const materialItems = board.items;
  const stock = stockLevels(materialItems);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock Levels vs Reorder</CardTitle>
        </CardHeader>
        <CardContent>
          <StockLevelChart data={stock} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Warehouse Inventory</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialItems.map((m) => {
                const low = isLowStock(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.name}
                      {low && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" /> low
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{materialCategoryLabel[m.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={low ? "font-semibold text-destructive" : ""}>
                        {formatNumber(m.stockQty, 1)} {m.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(m.reorderLevel, 1)} {m.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(m.rate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(m.stockQty * m.rate, { compact: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
