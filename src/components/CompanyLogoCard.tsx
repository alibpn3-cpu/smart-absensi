import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyLogoCardProps {
  logoUrl: string | null | undefined;
  className?: string;
}

const CompanyLogoCard: React.FC<CompanyLogoCardProps> = ({
  logoUrl,
  className,
}) => {
  const [hasError, setHasError] = React.useState(false);

  if (!logoUrl || hasError) {
    // Placeholder when no logo
    return (
      <Card className={cn('border-0 shadow-xl', className)}>
        <CardContent className="p-6 flex items-center justify-center" style={{ minHeight: '180px' }}>
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Building2 className="h-16 w-16 opacity-30" />
            <span className="text-sm opacity-50">Company Logo</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-0 shadow-xl', className)}>
      <CardContent className="p-6 flex items-center justify-center" style={{ minHeight: '180px' }}>
        <img 
          src={logoUrl} 
          alt="Company Logo" 
          className="max-h-[160px] max-w-full object-contain"
          onError={() => {
            console.log('Company logo failed to load');
            setHasError(true);
          }}
        />
      </CardContent>
    </Card>
  );
};

export default CompanyLogoCard;
