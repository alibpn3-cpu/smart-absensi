import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface P2HToolboxCardProps {
  staffUid: string;
  staffName: string;
  onChecklistChange?: (p2h: boolean, toolbox: boolean) => void;
}

const P2HToolboxCard = ({ staffUid, staffName, onChecklistChange }: P2HToolboxCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [p2hChecked, setP2hChecked] = useState(false);
  const [toolboxChecked, setToolboxChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing checklist for today
  useEffect(() => {
    const fetchChecklist = async () => {
      if (!staffUid) {
        setIsLoading(false);
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('p2h_toolbox_checklist')
          .select('p2h_checked, toolbox_checked')
          .eq('staff_uid', staffUid)
          .eq('checklist_date', today)
          .single();

        if (!error && data) {
          setP2hChecked(data.p2h_checked || false);
          setToolboxChecked(data.toolbox_checked || false);
        }
      } catch (error) {
        console.error('Error fetching checklist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChecklist();
  }, [staffUid]);

  // Notify parent of changes
  useEffect(() => {
    onChecklistChange?.(p2hChecked, toolboxChecked);
  }, [p2hChecked, toolboxChecked, onChecklistChange]);

  const saveChecklist = async (p2h: boolean, toolbox: boolean) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('p2h_toolbox_checklist')
        .upsert({
          staff_uid: staffUid,
          staff_name: staffName,
          checklist_date: today,
          p2h_checked: p2h,
          toolbox_checked: toolbox
        }, {
          onConflict: 'staff_uid,checklist_date'
        });

      if (error) {
        console.error('Error saving checklist:', error);
        toast.error('Gagal menyimpan checklist');
      }
    } catch (error) {
      console.error('Error in saveChecklist:', error);
    }
  };

  const handleP2HChange = (checked: boolean) => {
    setP2hChecked(checked);
    saveChecklist(checked, toolboxChecked);
  };

  const handleToolboxChange = (checked: boolean) => {
    setToolboxChecked(checked);
    saveChecklist(p2hChecked, checked);
  };

  if (isLoading) {
    return (
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 w-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-800 dark:text-blue-200">
                  Checklist Harian
                </span>
                {(p2hChecked || toolboxChecked) && (
                  <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                    {[p2hChecked && 'P2H', toolboxChecked && 'Toolbox'].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-white dark:bg-background rounded-lg border">
              <Checkbox
                id="p2h"
                checked={p2hChecked}
                onCheckedChange={handleP2HChange}
              />
              <Label 
                htmlFor="p2h" 
                className="text-sm font-medium cursor-pointer flex-1"
              >
                P2H (Pemeriksaan Harian)
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-white dark:bg-background rounded-lg border">
              <Checkbox
                id="toolbox"
                checked={toolboxChecked}
                onCheckedChange={handleToolboxChange}
              />
              <Label 
                htmlFor="toolbox" 
                className="text-sm font-medium cursor-pointer flex-1"
              >
                Toolbox Meeting
              </Label>
            </div>

            <p className="text-xs text-muted-foreground">
              Centang jika sudah melakukan P2H atau mengikuti Toolbox Meeting hari ini.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default P2HToolboxCard;
