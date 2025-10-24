import React, { useState } from "react";
import { Material } from "../../../api/materials";
import { MaterialList } from "./MaterialList";
import { MaterialForm } from "./MaterialForm";
import { MaterialPreview } from "./MaterialPreview";

export const MaterialPanel: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<Material | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = () => {
    setCurrentMaterial(undefined);
    setFormVisible(true);
  };

  const handleEdit = (material: Material) => {
    setCurrentMaterial(material);
    setFormVisible(true);
  };

  const handlePreview = (material: Material) => {
    setCurrentMaterial(material);
    setPreviewVisible(true);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setCurrentMaterial(undefined);
    setRefreshKey((prev) => prev + 1);
  };

  const handleFormCancel = () => {
    setFormVisible(false);
    setCurrentMaterial(undefined);
  };

  const handlePreviewClose = () => {
    setPreviewVisible(false);
    setCurrentMaterial(undefined);
  };

  return (
    <>
      <MaterialList
        key={refreshKey}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onPreview={handlePreview}
      />
      <MaterialForm
        visible={formVisible}
        material={currentMaterial}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
      <MaterialPreview
        visible={previewVisible}
        material={currentMaterial}
        onClose={handlePreviewClose}
      />
    </>
  );
};
