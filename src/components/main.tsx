import type { MainContentProps } from "@/components/MainContent";
import { MainContent } from "@/components/MainContent";
import { hasFileSystemAccess } from "@/lib/filesystem";

export type { MainContentProps };

const Main = (props: MainContentProps) => {
  if (props.demo_dicom_web || hasFileSystemAccess()) {
    return <MainContent {...props} />;
  }
  return (
    <div>
      <p>Unable to access FileSystem API.</p>
    </div>
  );
};

export { Main };
