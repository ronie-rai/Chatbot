import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface ColumnDef<T> {
  id: string;
  label: string;
  width?: number;
  defaultVisible?: boolean;
  sortValue?: (item: T) => string | number;
  renderCell: (item: T, index: number) => React.ReactNode;
}

export type TableDensity = "compact" | "standard" | "spacious";

export interface FlexibleDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string;
  emptyMessage?: string;
  onRowPress?: (item: T) => void;
  headerRight?: React.ReactNode;
  initialDensity?: TableDensity;
}

export function FlexibleDataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No records found matching filters.",
  onRowPress,
  headerRight,
  initialDensity = "standard",
}: FlexibleDataTableProps<T>) {
  const [density, setDensity] = useState<TableDensity>(initialDensity);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() =>
    columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)
  );
  const [sortColId, setSortColId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isColumnModalVisible, setIsColumnModalVisible] = useState(false);

  // Active columns
  const activeColumns = useMemo(() => {
    return columns.filter((col) => visibleColumnIds.includes(col.id));
  }, [columns, visibleColumnIds]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColId) return data;
    const colDef = columns.find((c) => c.id === sortColId);
    if (!colDef?.sortValue) return data;
    const getter = colDef.sortValue;

    return [...data].sort((a, b) => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA === valB) return 0;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortColId, sortDir, columns]);

  const toggleSort = (colId: string) => {
    const colDef = columns.find((c) => c.id === colId);
    if (!colDef?.sortValue) return;

    if (sortColId === colId) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortColId(null);
        setSortDir("asc");
      }
    } else {
      setSortColId(colId);
      setSortDir("asc");
    }
  };

  const toggleColumnVisibility = (colId: string) => {
    setVisibleColumnIds((prev) => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev; // At least one column must be visible
        return prev.filter((id) => id !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const densityStyles = useMemo(() => {
    switch (density) {
      case "compact":
        return {
          headerPad: 7,
          cellPad: 7,
          fontSize: 11,
          headerSize: 10,
        };
      case "spacious":
        return {
          headerPad: 14,
          cellPad: 14,
          fontSize: 14,
          headerSize: 12,
        };
      case "standard":
      default:
        return {
          headerPad: 10,
          cellPad: 10,
          fontSize: 13,
          headerSize: 11,
        };
    }
  }, [density]);

  return (
    <View style={styles.container}>
      {/* Table Toolbar */}
      <View style={styles.toolbarRow}>
        <View style={styles.toolbarLeft}>
          <Text style={styles.recordCountText}>
            Showing <Text style={styles.recordCountHighlight}>{sortedData.length}</Text> records
          </Text>
        </View>

        <View style={styles.toolbarRight}>
          {headerRight}

          {/* Density Selector */}
          <View style={styles.densityPillGroup}>
            {(["compact", "standard", "spacious"] as TableDensity[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.densityPill, density === d && styles.densityPillActive]}
                onPress={() => setDensity(d)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.densityPillText,
                    density === d && styles.densityPillTextActive,
                  ]}
                >
                  {d === "compact" ? "S" : d === "standard" ? "M" : "L"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Column Customizer Button */}
          <TouchableOpacity
            style={styles.columnsBtn}
            onPress={() => setIsColumnModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.columnsBtnIcon}>⚙️</Text>
            <Text style={styles.columnsBtnText}>
              Columns ({activeColumns.length}/{columns.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Table Container with Horizontal Scroll */}
      <View style={styles.tableBorderWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
          <View>
            {/* Table Header Row */}
            <View style={styles.headerRow}>
              {activeColumns.map((col) => {
                const isSorted = sortColId === col.id;
                const canSort = !!col.sortValue;
                const colWidth = col.width || 140;

                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[
                      styles.headerCell,
                      { width: colWidth, paddingVertical: densityStyles.headerPad },
                    ]}
                    onPress={() => canSort && toggleSort(col.id)}
                    activeOpacity={canSort ? 0.7 : 1}
                    disabled={!canSort}
                  >
                    <Text
                      style={[
                        styles.headerCellText,
                        { fontSize: densityStyles.headerSize },
                        isSorted && styles.headerCellTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {col.label.toUpperCase()}
                    </Text>
                    {canSort && (
                      <Text style={[styles.sortIcon, isSorted && styles.sortIconActive]}>
                        {isSorted ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Table Body Rows */}
            {sortedData.length === 0 ? (
              <View style={[styles.emptyWrap, { width: Math.max(500, activeColumns.reduce((acc, c) => acc + (c.width || 140), 0)) }]}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : (
              sortedData.map((item, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                return (
                  <TouchableOpacity
                    key={keyExtractor(item, rowIdx)}
                    style={[
                      styles.bodyRow,
                      isEven ? styles.bodyRowEven : styles.bodyRowOdd,
                    ]}
                    onPress={() => onRowPress?.(item)}
                    activeOpacity={onRowPress ? 0.7 : 1}
                    disabled={!onRowPress}
                  >
                    {activeColumns.map((col) => {
                      const colWidth = col.width || 140;
                      return (
                        <View
                          key={col.id}
                          style={[
                            styles.bodyCell,
                            { width: colWidth, paddingVertical: densityStyles.cellPad },
                          ]}
                        >
                          {col.renderCell(item, rowIdx)}
                        </View>
                      );
                    })}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      {/* Column Customizer Modal */}
      <Modal
        visible={isColumnModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsColumnModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Customize Table Columns</Text>
                <Text style={styles.modalSubtitle}>
                  Add or remove columns to adjust table breadth
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsColumnModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setVisibleColumnIds(columns.map((c) => c.id))}
              >
                <Text style={styles.presetChipText}>Select All ({columns.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setVisibleColumnIds(
                    columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)
                  )
                }
              >
                <Text style={styles.presetChipText}>Default Essential</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setVisibleColumnIds(columns.slice(0, 3).map((c) => c.id))}
              >
                <Text style={styles.presetChipText}>Minimal (3 cols)</Text>
              </TouchableOpacity>
            </View>

            {/* Columns List */}
            <ScrollView style={styles.colListScroll}>
              {columns.map((col) => {
                const isSelected = visibleColumnIds.includes(col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[styles.colOptionItem, isSelected && styles.colOptionItemSelected]}
                    onPress={() => toggleColumnVisibility(col.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.colOptionLeft}>
                      <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxChecked]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.colOptionLabel, isSelected && styles.colOptionLabelActive]}>
                        {col.label}
                      </Text>
                    </View>
                    <Text style={styles.colWidthBadge}>
                      {col.width || 140}px
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Text style={styles.footerInfoText}>
                {visibleColumnIds.length} of {columns.length} columns active
              </Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setIsColumnModalVisible(false)}
              >
                <Text style={styles.doneBtnText}>Apply & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordCountText: {
    color: "#8B9BB4",
    fontSize: 12,
    fontWeight: "500",
  },
  recordCountHighlight: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  densityPillGroup: {
    flexDirection: "row",
    backgroundColor: "#162032",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#26354D",
    padding: 2,
  },
  densityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  densityPillActive: {
    backgroundColor: "#3B82F6",
  },
  densityPillText: {
    color: "#8B9BB4",
    fontSize: 11,
    fontWeight: "700",
  },
  densityPillTextActive: {
    color: "#FFFFFF",
  },
  columnsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#162032",
    borderWidth: 1,
    borderColor: "#26354D",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  columnsBtnIcon: {
    fontSize: 12,
  },
  columnsBtnText: {
    color: "#C5D1E2",
    fontSize: 12,
    fontWeight: "600",
  },

  tableBorderWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#223048",
    backgroundColor: "#0F1624",
    overflow: "hidden",
  },
  horizontalScroll: {
    width: "100%",
  },

  headerRow: {
    flexDirection: "row",
    backgroundColor: "#172338",
    borderBottomWidth: 1,
    borderBottomColor: "#253754",
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: "#202E46",
  },
  headerCellText: {
    color: "#8B9BB4",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerCellTextActive: {
    color: "#38BDF8",
  },
  sortIcon: {
    color: "#64748B",
    fontSize: 11,
    marginLeft: 3,
  },
  sortIconActive: {
    color: "#38BDF8",
  },

  bodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1B273C",
  },
  bodyRowEven: {
    backgroundColor: "#0F1624",
  },
  bodyRowOdd: {
    backgroundColor: "#131C2D",
  },
  bodyCell: {
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#1B273C",
  },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#121A2B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#283956",
    padding: 18,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#F0F6FC",
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#8B9BB4",
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    color: "#8B9BB4",
    fontSize: 16,
    fontWeight: "700",
  },
  presetsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  presetChip: {
    backgroundColor: "#1C273C",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2D3F5E",
  },
  presetChipText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "600",
  },
  colListScroll: {
    maxHeight: 280,
    marginVertical: 4,
  },
  colOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#162135",
  },
  colOptionItemSelected: {
    backgroundColor: "#1D2D49",
    borderWidth: 1,
    borderColor: "#3B82F640",
  },
  colOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#4A5E80",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  colOptionLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  colOptionLabelActive: {
    color: "#F1F5F9",
    fontWeight: "600",
  },
  colWidthBadge: {
    color: "#64748B",
    fontSize: 11,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#202E46",
  },
  footerInfoText: {
    color: "#8B9BB4",
    fontSize: 12,
  },
  doneBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
