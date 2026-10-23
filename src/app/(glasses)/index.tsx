import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { renderDays } from '../../glasses/schedule';
import { DAY_NAMES_SHORT, dayOfWeek, formatLongDate, formatTime, todayISO, weekDates } from '../../glasses/time';
import { useGlasses } from '../../glasses/GlassesProvider';
import type { ClassStatus } from '../../glasses/types';
import { Card, Empty, Loading, Row, Screen, Section, Tag, Txt } from '../../ui/kit';
import { radius, space, useTheme } from '../../ui/theme';

const STATUS: Record<ClassStatus, string | null> = { SCHEDULED: null, ATTENDED: 'Attended', ABSENT: 'Absent', CANCELLED: 'Cancelled' };

export default function Calendar() {
  const { c } = useTheme();
  const { data, ready } = useGlasses();
  const today = todayISO();
  const [date, setDate] = useState(today);
  if (!ready) return <Loading />;
  const week = weekDates(date);
  const [day] = renderDays(data, [date]);
  const items = [
    ...day.classes.map((k) => ({ key: `c${k.courseId}-${k.startTime}`, title: k.courseName, time: `${formatTime(k.startTime)} – ${formatTime(k.endTime)}`, sub: [k.courseType.toLowerCase(), k.location].filter(Boolean).join(' · '), color: k.color, status: STATUS[k.status] })),
    ...[...day.events, ...day.recurringEvents].map((e) => ({ key: `e${e.id}-${e.title}`, title: e.title, time: e.start_time ? formatTime(e.start_time) : 'All day', sub: e.note ?? '', color: e.color, status: null })),
  ];

  return (
    <Screen title="Calendar" glow>
      <Txt color="muted">{formatLongDate(date)}</Txt>
      <Row gap={space.xs}>
        {week.map((d) => {
          const on = d === date;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={formatLongDate(d)}
              onPress={() => setDate(d)}
              style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.s, borderRadius: radius.pill, backgroundColor: on ? c.accent : 'transparent' }}
            >
              <Txt v="caption" color={on ? 'onAccent' : 'muted'}>{DAY_NAMES_SHORT[dayOfWeek(d)]}</Txt>
              <Txt v="label" num color={on ? 'onAccent' : d === today ? 'accentText' : 'ink'}>{Number(d.slice(8))}</Txt>
            </Pressable>
          );
        })}
      </Row>
      <Section title={date === today ? 'Today' : DAY_NAMES_SHORT[dayOfWeek(date)]}>
        {day.cleared && <Tag label="No classes — day cleared" outline />}
        {items.length === 0 ? (
          <Empty icon="sun" title="Nothing scheduled" body={data.semester ? 'A free day.' : 'Set up a semester to see your timetable here.'} />
        ) : (
          items.map((it) => (
            <Card key={it.key}>
              <Row gap={space.m}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: it.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="heading" numberOfLines={1}>{it.title}</Txt>
                  <Txt v="caption" color="muted" num>{it.time}{it.sub ? ` · ${it.sub}` : ''}</Txt>
                </View>
                {it.status && <Tag label={it.status} outline />}
              </Row>
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
